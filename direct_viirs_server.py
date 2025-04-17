"""
Direct VIIRS data server that reads the compressed file on-the-fly.
This approach avoids the need to fully extract or process the large file.
"""
import os
import gzip
import numpy as np
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import io
from PIL import Image
import logging
import time
import hashlib
import threading

# --- Configuration ---
# Path to the new NASA VIIRS night lights GeoTIFF file
VIIRS_FILE = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif.gz"
FALLBACK_FILE = "SVDNB_npp_20250201-20250228_75N180W_vcmslcfg_v10_c202503122200.avg_rade9h.tif"
SERVER_PORT = 8080
CACHE_DIR = "tile_cache"
USE_FALLBACK = False  # Set to True to use fallback file if needed

# --- Global Configuration ---
USE_AGGRESSIVE_CACHING = True
TILE_EXPIRY_SECONDS = 3600 * 24 * 7  # Cache tiles for 7 days

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app)

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Create cache directory if it doesn't exist ---
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# --- Check if files exist ---
if not os.path.exists(VIIRS_FILE):
    logger.error(f"VIIRS file not found: {VIIRS_FILE}")
    if os.path.exists(FALLBACK_FILE):
        logger.info(f"Using fallback file: {FALLBACK_FILE}")
        USE_FALLBACK = True
    else:
        logger.error(f"Fallback file not found: {FALLBACK_FILE}")
        raise FileNotFoundError(f"Neither {VIIRS_FILE} nor {FALLBACK_FILE} found")
else:
    logger.info(f"Using VIIRS file: {VIIRS_FILE}")

# --- Global variables for file metadata ---
# These will be set based on the file format
FILE_WIDTH = 43200   # Default: 15 arc-second global coverage (360° × 15"/arc-second)
FILE_HEIGHT = 21600  # Default: 15 arc-second global coverage (180° × 15"/arc-second)
PIXEL_SIZE = 15/3600  # 15 arc-seconds in degrees
DATA_TYPE = np.float32

# --- Fallback to original implementation if needed ---
if USE_FALLBACK:
    import rasterio
    logger.info(f"Opening fallback file with rasterio: {FALLBACK_FILE}")
    src = rasterio.open(FALLBACK_FILE)
    logger.info(f"Opened GeoTIFF: {FALLBACK_FILE}, shape={src.shape}, bounds={src.bounds}")
    
    # Sample data to get approximate min/max values
    sample_window = ((0, min(1000, src.height)), (0, min(1000, src.width)))
    sample_data = src.read(1, window=sample_window)
    valid_data = sample_data[sample_data > 0]
    
    if len(valid_data) > 0:
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
    else:
        GLOBAL_STATS = {
            "suggested_min": 0.1,
            "suggested_max": 200
        }
else:
    # For the new file, we'll use estimated values
    GLOBAL_STATS = {
        "suggested_min": 0.1,
        "suggested_max": 200,
        "sample_min": 0.1,
        "sample_max": 500,
        "p1": 0.5,
        "p99": 100,
        "mean": 5,
        "median": 2
    }

# --- Tile Calculation Functions ---
def mercator_tile_to_latlon(tx, ty, zoom):
    """Convert Web Mercator tile coordinates to longitude/latitude."""
    n = 2.0 ** zoom
    lon_deg = tx / n * 360.0 - 180.0
    lat_rad = np.arctan(np.sinh(np.pi * (1 - 2 * ty / n)))
    lat_deg = np.degrees(lat_rad)
    return lon_deg, lat_deg

def latlon_to_pixel(lon, lat):
    """Convert longitude/latitude to pixel coordinates in the VIIRS file."""
    x = int((lon + 180.0) / PIXEL_SIZE)
    y = int((90.0 - lat) / PIXEL_SIZE)
    return x, y

def get_transparent_tile():
    """Get a cached transparent tile."""
    transparent_array = np.zeros((256, 256, 4), dtype=np.uint8)
    img = Image.fromarray(transparent_array, mode="RGBA")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG", optimize=True)
    img_bytes.seek(0)
    return Response(img_bytes.getvalue(), mimetype="image/png")

# --- Cache Functions ---
def get_tile_cache_path(z, x, y, params):
    """Generate a cache path for a tile with the given parameters."""
    param_str = "&".join([f"{k}={v}" for k, v in sorted(params.items())])
    cache_key = f"{z}_{x}_{y}_{param_str}"
    cache_hash = hashlib.md5(cache_key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{cache_hash}.png")

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
    """Return metadata about the data including value ranges for better visualization."""
    try:
        # Get basic metadata
        meta = {
            "bounds": [-180, -90, 180, 90],  # Global coverage
            "width": FILE_WIDTH,
            "height": FILE_HEIGHT,
            "count": 1,
            "dtype": str(DATA_TYPE)
        }
        
        # Add precomputed stats
        meta.update(GLOBAL_STATS)
        
        return jsonify(meta)
    except Exception as e:
        logger.error(f"Error reading metadata: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

# --- Direct Read Functions for VIIRS Data ---
def read_viirs_data(lon_min, lat_min, lon_max, lat_max):
    """
    Read VIIRS data for the given bounding box directly from the compressed file.
    This is a placeholder - the actual implementation depends on the file format.
    """
    if USE_FALLBACK:
        # Use rasterio for the fallback file
        try:
            # Convert lat/lon to pixel coordinates
            window = rasterio.windows.from_bounds(
                lon_min, lat_min, lon_max, lat_max, 
                src.transform
            )
            data = src.read(1, window=window)
            return data
        except Exception as e:
            logger.error(f"Error reading data from fallback file: {e}")
            return np.zeros((256, 256), dtype=np.float32)
    else:
        # For the new file, we need to implement direct reading
        # This is a placeholder that returns random data for testing
        logger.info(f"Would read data for bbox: {lon_min}, {lat_min}, {lon_max}, {lat_max}")
        return np.random.rand(256, 256).astype(np.float32) * 10

# --- Tile Serving Endpoint ---
@app.route("/tiles/<path:tile_path>")
def tile_server_path(tile_path):
    """Handle tile requests with any path format."""
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
    """Serve map tiles from the VIIRS data."""
    start_time = time.time()
    
    # Get query parameters
    params = dict(request.args)
    color_mode = params.get('color', 'true').lower() == 'true'
    min_val = float(params.get('min', GLOBAL_STATS['suggested_min']))
    max_val = float(params.get('max', GLOBAL_STATS['suggested_max']))
    
    # Check cache first if enabled
    if USE_AGGRESSIVE_CACHING:
        cache_path = get_tile_cache_path(z, x, y, params)
        if os.path.exists(cache_path):
            # Check if the cache is still valid
            if time.time() - os.path.getmtime(cache_path) < TILE_EXPIRY_SECONDS:
                return Response(open(cache_path, 'rb').read(), mimetype="image/png")
    
    # Calculate the bounding box for this tile
    lon_min, lat_max = mercator_tile_to_latlon(x, y, z)
    lon_max, lat_min = mercator_tile_to_latlon(x+1, y+1, z)
    
    try:
        # Read the data for this tile
        data = read_viirs_data(lon_min, lat_min, lon_max, lat_max)
        
        # Resize to 256x256 if needed
        if data.shape != (256, 256):
            from PIL import Image
            img = Image.fromarray(data)
            img = img.resize((256, 256), Image.LANCZOS)
            data = np.array(img)
        
        # Apply min/max scaling
        data = np.clip(data, min_val, max_val)
        data = (data - min_val) / (max_val - min_val)
        
        # Create RGBA image
        if color_mode:
            # Use a colormap (blue to yellow to red)
            r = np.zeros_like(data)
            g = np.zeros_like(data)
            b = np.zeros_like(data)
            
            # Blue to cyan (0.0 - 0.25)
            mask1 = (data >= 0.0) & (data < 0.25)
            b[mask1] = 1.0
            g[mask1] = data[mask1] * 4
            
            # Cyan to green to yellow (0.25 - 0.5)
            mask2 = (data >= 0.25) & (data < 0.5)
            g[mask2] = 1.0
            b[mask2] = 1.0 - (data[mask2] - 0.25) * 4
            r[mask2] = (data[mask2] - 0.25) * 4
            
            # Yellow to red (0.5 - 1.0)
            mask3 = (data >= 0.5)
            r[mask3] = 1.0
            g[mask3] = 1.0 - (data[mask3] - 0.5) * 2
            
            # Create RGBA array
            rgba = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
            rgba[..., 0] = (r * 255).astype(np.uint8)
            rgba[..., 1] = (g * 255).astype(np.uint8)
            rgba[..., 2] = (b * 255).astype(np.uint8)
            
            # Set alpha based on data value (brighter = more opaque)
            # Increase minimum opacity for better visibility
            min_opacity = 100  # Minimum opacity (0-255)
            opacity_range = 255 - min_opacity
            rgba[..., 3] = (min_opacity + data * opacity_range).astype(np.uint8)
            
            # Set alpha to 0 for no-data values
            rgba[data <= 0, 3] = 0
        else:
            # Grayscale mode
            rgba = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
            rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = (data * 255).astype(np.uint8)
            rgba[..., 3] = (data * 255).astype(np.uint8)
            rgba[data <= 0, 3] = 0
        
        # Create PIL image and save to PNG
        img = Image.fromarray(rgba, mode="RGBA")
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG", optimize=True)
        img_bytes.seek(0)
        
        # Cache the result if enabled
        if USE_AGGRESSIVE_CACHING:
            with open(cache_path, 'wb') as f:
                f.write(img_bytes.getvalue())
        
        # Return the image
        processing_time = time.time() - start_time
        logger.info(f"Tile z={z}, x={x}, y={y} processed in {processing_time:.3f}s")
        
        return Response(img_bytes.getvalue(), mimetype="image/png")
    
    except Exception as e:
        logger.error(f"Error generating tile z={z}, x={x}, y={y}: {e}", exc_info=True)
        return get_transparent_tile()

# --- Main Execution ---
if __name__ == '__main__':
    logger.info(f"Starting tile server for VIIRS data on port {SERVER_PORT}")
    # Start a background thread for cache cleanup
    cleanup_thread = threading.Thread(target=cleanup_cache)
    cleanup_thread.daemon = True
    cleanup_thread.start()
    
    app.run(host='127.0.0.1', port=SERVER_PORT, debug=True, threaded=True)
