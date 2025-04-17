"""
Light Pollution Tile Server

This script serves map tiles from the large VIIRS night lights GeoTIFF file.
It uses rasterio and flask to create a lightweight tile server that processes
only the portions of the data needed for each tile request.
"""
import os
import rasterio
from rasterio.windows import Window
from flask import Flask, Response, request, jsonify
from flask_cors import CORS
import numpy as np
from PIL import Image
import io
import hashlib
import time
import logging
import threading

# --- Configuration ---
LIGHT_MAP_DIR = "lightmap"
GEOTIFF_PATH = os.path.join(LIGHT_MAP_DIR, "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.tif")
SERVER_PORT = 8081  # Use a different port than the main web server
CACHE_DIR = "light_tile_cache"  # Directory to store cached tiles
TILE_EXPIRY_SECONDS = 3600 * 24 * 7  # Cache tiles for 7 days

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Create cache directory if it doesn't exist ---
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# --- Global variable to hold dataset info ---
dataset_info = None

def load_dataset_info():
    """Load basic information about the dataset without keeping it open."""
    global dataset_info
    try:
        with rasterio.open(GEOTIFF_PATH) as src:
            dataset_info = {
                "bounds": src.bounds,
                "width": src.width,
                "height": src.height,
                "crs": str(src.crs),
                "transform": src.transform,
                "nodata": src.nodata
            }
            logger.info(f"Loaded dataset info: {dataset_info}")
    except Exception as e:
        logger.error(f"Error loading dataset info: {e}")
        dataset_info = None

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

# --- Tile calculation functions ---
def mercator_tile_to_latlon(tx, ty, zoom):
    """Convert Web Mercator tile coordinates to longitude/latitude."""
    n = 2.0 ** zoom
    lon_deg = tx / n * 360.0 - 180.0
    lat_rad = np.arctan(np.sinh(np.pi * (1 - 2 * ty / n)))
    lat_deg = np.degrees(lat_rad)
    return lon_deg, lat_deg

def get_tile_cache_path(z, x, y, params):
    """Generate a cache path for a tile with the given parameters."""
    param_str = "&".join([f"{k}={v}" for k, v in sorted(params.items())])
    cache_key = f"{z}_{x}_{y}_{param_str}"
    cache_hash = hashlib.md5(cache_key.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{cache_hash}.png")

def get_transparent_tile():
    """Get a cached transparent tile."""
    transparent_array = np.zeros((256, 256, 4), dtype=np.uint8)
    img = Image.fromarray(transparent_array, mode="RGBA")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG", optimize=True)
    img_bytes.seek(0)
    return Response(img_bytes.getvalue(), mimetype="image/png")

# --- API Endpoints ---
@app.route("/metadata")
def get_metadata():
    """Return metadata about the dataset."""
    if not dataset_info:
        load_dataset_info()
        
    if not dataset_info:
        return jsonify({"error": "Dataset info not available"}), 500
        
    return jsonify(dataset_info)

@app.route("/tiles/<int:z>/<int:x>/<int:y>.png")
def tile_server(z, x, y):
    """Serve map tiles from the light pollution dataset."""
    start_time = time.time()
    
    # Get query parameters
    params = dict(request.args)
    color_mode = params.get('color', 'true').lower() == 'true'
    min_val = float(params.get('min', 0.1))
    max_val = float(params.get('max', 100.0))
    opacity = float(params.get('opacity', 0.7))
    
    # Check cache first
    cache_path = get_tile_cache_path(z, x, y, params)
    if os.path.exists(cache_path):
        # Check if the cache is still valid
        if time.time() - os.path.getmtime(cache_path) < TILE_EXPIRY_SECONDS:
            return Response(open(cache_path, 'rb').read(), mimetype="image/png")
    
    # Calculate the bounding box for this tile
    lon_min, lat_max = mercator_tile_to_latlon(x, y, z)
    lon_max, lat_min = mercator_tile_to_latlon(x+1, y+1, z)
    
    # Skip tiles outside dataset bounds
    if not dataset_info:
        load_dataset_info()
        
    if not dataset_info:
        logger.error("Dataset info not available")
        return get_transparent_tile()
        
    bounds = dataset_info["bounds"]
    if (lon_max < bounds.left or lon_min > bounds.right or
        lat_min > bounds.top or lat_max < bounds.bottom):
        return get_transparent_tile()
    
    try:
        # Open the dataset for this specific tile
        with rasterio.open(GEOTIFF_PATH) as src:
            # Create a window for the portion of data we need
            window = src.window(lon_min, lat_min, lon_max, lat_max)
            
            # Read the data (with optimized window size)
            window_floored = Window(int(window.col_off), int(window.row_off),
                                   int(window.width), int(window.height))
            if window_floored.width <= 0 or window_floored.height <= 0:
                return get_transparent_tile()
                
            data = src.read(1, window=window_floored)
            
            # Handle empty data case
            if data.size == 0 or np.all(data == src.nodata):
                return get_transparent_tile()
                
            # Resize to 256x256
            if data.shape != (256, 256):
                img = Image.fromarray(data.astype(np.float32))
                img = img.resize((256, 256), Image.BICUBIC)
                data = np.array(img)
            
            # Apply min/max scaling
            valid_mask = (data != src.nodata) & ~np.isnan(data)
            if not np.any(valid_mask):
                return get_transparent_tile()
                
            # Clip and normalize data
            data = np.clip(data, min_val, max_val)
            data_norm = np.zeros_like(data, dtype=np.float32)
            data_norm[valid_mask] = (data[valid_mask] - min_val) / (max_val - min_val)
            
            # Create RGBA image
            rgba = np.zeros((data.shape[0], data.shape[1], 4), dtype=np.uint8)
            
            if color_mode:
                # Use a colormap (blue to cyan to yellow to red)
                r = np.zeros_like(data_norm)
                g = np.zeros_like(data_norm)
                b = np.zeros_like(data_norm)
                
                # Blue (0.0 - 0.25)
                mask1 = (data_norm >= 0.0) & (data_norm < 0.25) & valid_mask
                b[mask1] = 1.0
                g[mask1] = data_norm[mask1] * 4
                
                # Cyan to green to yellow (0.25 - 0.5)
                mask2 = (data_norm >= 0.25) & (data_norm < 0.5) & valid_mask
                g[mask2] = 1.0
                b[mask2] = 1.0 - (data_norm[mask2] - 0.25) * 4
                r[mask2] = (data_norm[mask2] - 0.25) * 4
                
                # Yellow to red (0.5 - 1.0)
                mask3 = (data_norm >= 0.5) & valid_mask
                r[mask3] = 1.0
                g[mask3] = 1.0 - (data_norm[mask3] - 0.5) * 2
                
                # Create RGBA array
                rgba[..., 0] = (r * 255).astype(np.uint8)
                rgba[..., 1] = (g * 255).astype(np.uint8)
                rgba[..., 2] = (b * 255).astype(np.uint8)
                
                # Set alpha based on data value and opacity parameter
                # Higher values are more opaque
                alpha = np.zeros_like(data_norm)
                alpha[valid_mask] = data_norm[valid_mask] * opacity * 255
                rgba[..., 3] = alpha.astype(np.uint8)
            else:
                # Grayscale mode
                val = np.zeros_like(data_norm)
                val[valid_mask] = data_norm[valid_mask] * 255
                rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = val.astype(np.uint8)
                
                # Set alpha
                alpha = np.zeros_like(data_norm)
                alpha[valid_mask] = opacity * 255
                rgba[..., 3] = alpha.astype(np.uint8)
            
            # Create PIL image and save to PNG
            img = Image.fromarray(rgba, mode="RGBA")
            img_bytes = io.BytesIO()
            img.save(img_bytes, format="PNG", optimize=True)
            img_bytes.seek(0)
            
            # Cache the result
            with open(cache_path, 'wb') as f:
                f.write(img_bytes.getvalue())
            
            # Return the image
            processing_time = time.time() - start_time
            logger.info(f"Tile z={z}, x={x}, y={y} processed in {processing_time:.3f}s")
            
            return Response(img_bytes.getvalue(), mimetype="image/png")
    
    except Exception as e:
        logger.error(f"Error generating tile z={z}, x={x}, y={y}: {e}", exc_info=True)
        return get_transparent_tile()

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

# --- Main Execution ---
if __name__ == '__main__':
    logger.info(f"Starting light pollution tile server on port {SERVER_PORT}")
    
    # Load dataset info at startup
    load_dataset_info()
    
    # Start a background thread for cache cleanup
    cleanup_thread = threading.Thread(target=cleanup_cache)
    cleanup_thread.daemon = True
    cleanup_thread.start()
    
    app.run(host='127.0.0.1', port=SERVER_PORT, debug=True, threaded=True)
