import rasterio
from flask import Flask, Response, request, jsonify, send_file
from flask_cors import CORS
import logging
import numpy as np
from PIL import Image
import io
import os
import hashlib
import time
import random
import threading
import gzip
import shutil

# --- Configuration ---
# Path to the NASA VIIRS night lights GeoTIFF file
GEOTIFF_PATH = "SVDNB_npp_20250201-20250228_75N180W_vcmslcfg_v10_c202503122200.avg_rade9h.tif"
# New file to be integrated later
NEW_GEOTIFF_PATH = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif.gz"
FALLBACK_GEOTIFF_PATH = "SVDNB_npp_20250201-20250228_75N180W_vcmslcfg_v10_c202503122200.avg_rade9h.tif"
EXTRACTED_GEOTIFF_PATH = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.tif"
SERVER_PORT = 8080  # Port the server will run on
CACHE_DIR = "tile_cache"  # Directory to store cached tiles
CACHE_TIME = 3600 * 24 * 7  # Cache for 1 week (in seconds)

# --- Global Configuration for Optimization ---
# Enable this for production use
USE_AGGRESSIVE_CACHING = True
TILE_EXPIRY_SECONDS = 3600 * 24 * 7  # Cache tiles for 7 days
GC_PROBABILITY = 0.05  # 5% chance to run garbage collection on each request
ENABLE_ETAGS = True  # Enable HTTP ETags for caching
LOW_MEMORY_MODE = True  # Reduce memory usage at cost of slightly slower processing

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app)  # Allow requests from the local HTML file

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Create cache directory if it doesn't exist ---
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# --- Try to extract and use the new GeoTIFF file ---
def extract_and_prepare_geotiff():
    """Extract the compressed GeoTIFF file and prepare it for use."""
    try:
        # Check if the extracted file already exists
        if os.path.exists(EXTRACTED_GEOTIFF_PATH):
            logger.info(f"Using previously extracted GeoTIFF: {EXTRACTED_GEOTIFF_PATH}")
            return EXTRACTED_GEOTIFF_PATH
        
        # Check if the new compressed file exists
        if os.path.exists(NEW_GEOTIFF_PATH):
            logger.info(f"Extracting compressed GeoTIFF: {NEW_GEOTIFF_PATH}")
            
            # Extract the compressed file
            try:
                with gzip.open(NEW_GEOTIFF_PATH, 'rb') as f_in:
                    with open(EXTRACTED_GEOTIFF_PATH, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                logger.info(f"Successfully extracted to: {EXTRACTED_GEOTIFF_PATH}")
                
                # Try to open the extracted file with rasterio to verify it works
                try:
                    with rasterio.open(EXTRACTED_GEOTIFF_PATH) as test_src:
                        logger.info(f"Successfully verified extracted GeoTIFF: {test_src.shape}, {test_src.bounds}")
                    return EXTRACTED_GEOTIFF_PATH
                except Exception as e:
                    logger.error(f"Extracted file is not a valid GeoTIFF: {e}")
                    # If the extracted file doesn't work, fall back to the original
                    return FALLBACK_GEOTIFF_PATH
            except Exception as e:
                logger.error(f"Error extracting compressed file: {e}")
                return FALLBACK_GEOTIFF_PATH
        else:
            logger.warning(f"New GeoTIFF file not found: {NEW_GEOTIFF_PATH}")
            return FALLBACK_GEOTIFF_PATH
    except Exception as e:
        logger.error(f"Unexpected error preparing GeoTIFF: {e}")
        return FALLBACK_GEOTIFF_PATH

# Determine which GeoTIFF file to use
# GEOTIFF_PATH = extract_and_prepare_geotiff()
logger.info(f"Using GeoTIFF file: {GEOTIFF_PATH}")

# --- Open the GeoTIFF once at startup and keep it open ---
src = rasterio.open(GEOTIFF_PATH)
logger.info(f"Opened GeoTIFF: {GEOTIFF_PATH}, shape={src.shape}, bounds={src.bounds}")

# --- Precompute tile stats ---
try:
    # Sample data to get approximate min/max values (do this once at startup)
    sample_window = ((0, min(1000, src.height)), (0, min(1000, src.width)))
    sample_data = src.read(1, window=sample_window)
    valid_data = sample_data[sample_data > 0]  # Exclude no-data values
    
    if len(valid_data) > 0:
        # Calculate percentiles to avoid outliers skewing the range
        GLOBAL_STATS = {
            "sample_min": float(valid_data.min()),
            "sample_max": float(valid_data.max()),
            "p1": float(np.percentile(valid_data, 1)),
            "p99": float(np.percentile(valid_data, 99)),
            "mean": float(np.mean(valid_data)),
            "median": float(np.median(valid_data)),
            "suggested_min": float(max(0.1, np.percentile(valid_data, 1))),
            "suggested_max": float(min(200, np.percentile(valid_data, 99)))
        }
        logger.info(f"Precomputed global stats: {GLOBAL_STATS}")
    else:
        GLOBAL_STATS = {
            "suggested_min": 0.1,
            "suggested_max": 200
        }
except Exception as e:
    logger.error(f"Error precomputing global stats: {e}", exc_info=True)
    GLOBAL_STATS = {
        "suggested_min": 0.1,
        "suggested_max": 200
    }

# --- Cache Management ---
def cleanup_cache():
    """Periodically clean up old cache files."""
    if not os.path.exists(CACHE_DIR):
        return
        
    current_time = time.time()
    cleaned = 0
    
    try:
        for filename in os.listdir(CACHE_DIR):
            cache_path = os.path.join(CACHE_DIR, filename)
            if os.path.isfile(cache_path):
                # If file is older than TILE_EXPIRY_SECONDS, delete it
                file_age = current_time - os.path.getmtime(cache_path)
                if file_age > TILE_EXPIRY_SECONDS:
                    os.remove(cache_path)
                    cleaned += 1
    except Exception as e:
        logger.error(f"Error cleaning cache: {e}")
    
    logger.info(f"Cache cleanup completed. Removed {cleaned} expired tiles.")

# --- Metadata Endpoint ---
@app.route("/metadata")
def get_metadata():
    """Return metadata about the GeoTIFF including value ranges for better visualization."""
    try:
        # Get basic metadata
        meta = {
            "bounds": list(src.bounds),
            "crs": str(src.crs),
            "width": src.width,
            "height": src.height,
            "count": src.count,
            "dtype": str(src.dtypes[0])
        }
        
        # Add precomputed stats
        meta.update(GLOBAL_STATS)
        
        return jsonify(meta)
    except Exception as e:
        logger.error(f"Error reading metadata: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# Function to calculate Web Mercator tile coordinates (cached for performance)
def mercator_tile_to_latlon(tx, ty, zoom):
    """Convert Web Mercator tile coordinates to longitude/latitude."""
    n = 2.0 ** zoom
    lon_deg = tx / n * 360.0 - 180.0
    lat_rad = np.arctan(np.sinh(np.pi * (1 - 2 * ty / n)))
    lat_deg = np.degrees(lat_rad)
    return lon_deg, lat_deg

# Create a transparent tile once and reuse it
TRANSPARENT_TILE = None
def get_transparent_tile():
    """Get a cached transparent tile."""
    global TRANSPARENT_TILE
    if TRANSPARENT_TILE is None:
        transparent_array = np.zeros((256, 256, 4), dtype=np.uint8)
        img = Image.fromarray(transparent_array, mode="RGBA")
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG", optimize=True)
        img_bytes.seek(0)
        TRANSPARENT_TILE = img_bytes.getvalue()
    return Response(TRANSPARENT_TILE, mimetype="image/png")

# --- Tile Serving Endpoint ---
@app.route("/tiles/<path:tile_path>")
def tile_server_path(tile_path):
    """Handle tile requests with any path format, including fractional zoom levels."""
    try:
        # Parse the path which might be in format z/x/y.png or other variations
        parts = tile_path.replace('.png', '').split('/')
        
        # Handle different path formats
        if len(parts) >= 3:
            z_str, x_str, y_str = parts[-3], parts[-2], parts[-1]
            
            # Handle fractional zoom levels (e.g., 6.5)
            if '.' in z_str:
                z = float(z_str)
                # Round to nearest integer for processing
                z_int = int(round(z))
                logger.info(f"Handling fractional zoom level {z} as {z_int}")
                z = z_int
            else:
                z = int(z_str)
                
            x = int(x_str)
            y = int(y_str)
            
            # Redirect to the integer-based handler
            return tile_server(z, x, y)
        else:
            logger.error(f"Invalid tile path format: {tile_path}")
            return get_transparent_tile()
    except Exception as e:
        logger.error(f"Error parsing tile path '{tile_path}': {e}")
        return get_transparent_tile()

@app.route("/tiles/<int:z>/<int:x>/<int:y>.png")
def tile_server(z, x, y):
    """Serve map tiles from the GeoTIFF."""
    start_time = time.time()
    logger.info(f"Requesting tile: z={z}, x={x}, y={y}")
    
    # Special handling for problematic tiles we've identified
    problematic_tiles = [
        (6, 19, 42), (6, 22, 42), (6, 18, 40), (6, 23, 40),
        (6, 18, 41), (6, 23, 41), (6, 18, 39), (6, 23, 39),
        (6, 18, 42), (6, 23, 42),
        # Add more problematic coordinates as needed
    ]
    
    # Check if this is a known problematic tile
    for prob_z, prob_x, prob_y in problematic_tiles:
        if z == prob_z and x == prob_x and y == prob_y:
            logger.info(f"Known problematic tile z={z}, x={x}, y={y}, returning transparent tile")
            return get_transparent_tile()
    
    # Run occasional garbage collection
    if random.random() < GC_PROBABILITY and LOW_MEMORY_MODE:
        import gc
        gc.collect()
        logger.debug("Running garbage collection")
        
    # Get visualization parameters from query string
    use_color = request.args.get('color', 'true').lower() == 'true'
    min_val = float(request.args.get('min', GLOBAL_STATS.get("suggested_min", 0.1)))
    max_val = float(request.args.get('max', GLOBAL_STATS.get("suggested_max", 200)))
    
    # Create cache key based on tile coordinates and parameters
    cache_key = f"tile_{z}_{x}_{y}_c{use_color}_min{min_val}_max{max_val}.png"
    cache_path = os.path.join(CACHE_DIR, cache_key)
    
    # Check if this tile is already in the cache
    if os.path.exists(cache_path):
        # Check if the cache is still valid
        cache_age = time.time() - os.path.getmtime(cache_path)
        if cache_age < CACHE_TIME:
            logger.info(f"Serving tile z={z}, x={x}, y={y} from cache")
            
            if ENABLE_ETAGS:
                # Generate ETag from file modification time and size
                etag = f'W/"{os.path.getmtime(cache_path)}-{os.path.getsize(cache_path)}"'
                if request.headers.get('If-None-Match') == etag:
                    return '', 304  # Not Modified
                response = send_file(cache_path, mimetype="image/png")
                response.headers['ETag'] = etag
                response.headers['Cache-Control'] = f'max-age={CACHE_TIME}'
                return response
            else:
                return send_file(cache_path, mimetype="image/png")
    
    # Check if the requested zoom level is beyond our processing capability
    if z > 11:  # Limit maximum zoom for performance
        return get_transparent_tile()
        
    # Probability-based cache cleanup
    if random.random() < 0.02:  # 2% chance to clean cache on each request
        threading.Thread(target=cleanup_cache).start()
    
    try:
        # Calculate the bounding box of this tile in the CRS of the GeoTIFF
        # Convert Web Mercator tile to lat/lon coordinates
        nw_lon, nw_lat = mercator_tile_to_latlon(x, y, z)  # Northwest corner
        se_lon, se_lat = mercator_tile_to_latlon(x+1, y+1, z)  # Southeast corner
        
        # Early check if this tile is likely outside our dataset's bounds
        # The VIIRS data covers approximately 75°N to 0°N, -180°W to -60°W
        if nw_lat < 0 or se_lat > 90 or nw_lon < -180 or se_lon > -60:
            logger.info(f"Tile z={z}, x={x}, y={y} is likely outside dataset region")
            return get_transparent_tile()
        
        # Create a window in the GeoTIFF's coordinates
        from rasterio.transform import rowcol
        from rasterio.windows import Window
        
        try:
            # Get pixel coordinates for the corners
            row_nw, col_nw = rowcol(src.transform, nw_lon, nw_lat)
            row_se, col_se = rowcol(src.transform, se_lon, se_lat)
            
            # Ensure we're not getting inverted windows
            row_min = min(row_nw, row_se)
            row_max = max(row_nw, row_se)
            col_min = min(col_nw, col_se)
            col_max = max(col_nw, col_se)
            
            # Create a window object
            window = Window.from_slices(
                (row_min, row_max),
                (col_min, col_max)
            )
            
            # Check if window is completely outside the raster
            if (row_min >= src.height or row_max <= 0 or 
                col_min >= src.width or col_max <= 0):
                logger.info(f"Tile z={z}, x={x}, y={y} is outside GeoTIFF bounds")
                return get_transparent_tile()
            
            # Constrain window to raster bounds
            window = window.intersection(Window(0, 0, src.width, src.height))
            
            # Check if we have a valid window after intersection
            if window.width <= 0 or window.height <= 0:
                logger.info(f"Tile z={z}, x={x}, y={y} has no valid data after intersection")
                return get_transparent_tile()

            # Add additional safety check for very large windows
            if window.width > 1000 or window.height > 1000:
                logger.info(f"Tile z={z}, x={x}, y={y} window too large: {window.width}x{window.height}")
                return get_transparent_tile()
            
            # Read data from the window with extra error handling
            try:
                data = src.read(1, window=window)
            except Exception as read_error:
                logger.error(f"Error reading data for tile z={z}, x={x}, y={y}: {read_error}")
                # Try reading with a smaller window if possible
                if window.width > 10 and window.height > 10:
                    try:
                        # Shrink the window to avoid potential corrupt areas
                        smaller_window = Window(window.col_off + window.width//4, 
                                              window.row_off + window.height//4,
                                              window.width//2, window.height//2)
                        data = src.read(1, window=smaller_window)
                        # Pad with zeros to maintain size
                        full_data = np.zeros((window.height, window.width), dtype=np.float32)
                        h_offset = window.height//4
                        w_offset = window.width//4
                        full_data[h_offset:h_offset+window.height//2, 
                                 w_offset:w_offset+window.width//2] = data
                        data = full_data
                        logger.info(f"Successfully read smaller window for tile z={z}, x={x}, y={y}")
                    except Exception as e:
                        logger.error(f"Failed with smaller window too: {e}")
                        return get_transparent_tile()
                else:
                    return get_transparent_tile()
                
            # Check if data is valid
            if data is None or data.size == 0:
                logger.info(f"Tile z={z}, x={x}, y={y} returned empty data")
                return get_transparent_tile()
            
            # Check if data is all zeros or too small
            if np.all(data == 0) or data.shape[0] < 2 or data.shape[1] < 2:
                logger.info(f"Tile z={z}, x={x}, y={y} contains no valid data values")
                return get_transparent_tile()
            
            # Resize to 256x256 for the tile
            try:
                img = Image.fromarray(data.astype(np.float32))
                img = img.resize((256, 256), Image.Resampling.LANCZOS)
                data = np.array(img)
            except Exception as resize_error:
                logger.error(f"Error resizing for tile z={z}, x={x}, y={y}: {resize_error}")
                return get_transparent_tile()
            
            # Apply logarithmic scaling
            # Add a small value to avoid log(0)
            data = np.where(data > 0, np.log1p(data), 0)
            
            # Rescale to 0-255 range using the logarithm of min/max values
            log_min = np.log1p(min_val) if min_val > 0 else 0
            log_max = np.log1p(max_val)
            
            # Clip and scale
            data = np.clip(data, log_min, log_max)
            scaling_range = log_max - log_min
            if scaling_range <= 0:
                # Avoid division by zero
                scaling_range = 1.0
            data = ((data - log_min) / scaling_range * 255).astype(np.uint8)
            
            # Create colored or grayscale output
            try:
                if use_color:
                    # Create a simple blue-to-white colormap
                    # Start with all blue
                    r = np.zeros_like(data)
                    g = np.zeros_like(data)
                    b = data.copy()
                    
                    # Add yellow to white gradient for higher values (above halfway point)
                    threshold = 128
                    mask = data > threshold
                    
                    # Calculate factor (0-1) for transition to yellow/white
                    factor = (data - threshold) / (255 - threshold)
                    factor = np.clip(factor, 0, 1)
                    
                    # Add red and green proportionally
                    r[mask] = factor[mask] * 255
                    g[mask] = factor[mask] * 255
                    
                    # Create alpha channel (transparent for no data)
                    alpha = np.where(data > 0, 255, 0).astype(np.uint8)
                    
                    # Combine into RGBA
                    rgba = np.dstack((r, g, b, alpha)).astype(np.uint8)
                    img = Image.fromarray(rgba, mode="RGBA")
                else:
                    # Grayscale with transparency
                    alpha = np.where(data > 0, 255, 0).astype(np.uint8)
                    grayscale = np.dstack((data, data, data, alpha)).astype(np.uint8)
                    img = Image.fromarray(grayscale, mode="RGBA")
                
                # Save image to cache
                img_bytes = io.BytesIO()
                img.save(img_bytes, format="PNG", optimize=True)
                img_bytes.seek(0)
                
                # Save to cache file
                with open(cache_path, 'wb') as f:
                    f.write(img_bytes.getvalue())
                
                # Return the tile
                end_time = time.time()
                logger.info(f"Generated tile z={z}, x={x}, y={y} in {end_time - start_time:.3f}s")
                return send_file(cache_path, mimetype="image/png")
            except Exception as image_error:
                logger.error(f"Error creating image for tile z={z}, x={x}, y={y}: {image_error}")
                return get_transparent_tile()
                
        except Exception as window_error:
            logger.error(f"Error with window calculation for tile z={z}, x={x}, y={y}: {window_error}")
            return get_transparent_tile()
        
    except Exception as e:
        logger.error(f"Error processing tile: {e}", exc_info=True)
        return get_transparent_tile()
    
# --- Main Execution ---
if __name__ == '__main__':
    logger.info(f"Starting tile server for {GEOTIFF_PATH} on port {SERVER_PORT}")
    app.run(host='127.0.0.1', port=SERVER_PORT, debug=True, threaded=True)
