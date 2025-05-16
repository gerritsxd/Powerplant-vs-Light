"""
Simple tile server that provides basic functionality without requiring the large VIIRS data files.
This is a temporary solution until the actual data files are available.
"""
from flask import Flask, Response, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
from PIL import Image
import io
import os
import hashlib
import time
import logging

# --- Configuration ---
SERVER_PORT = 8080
CACHE_DIR = "tile_cache"

# --- Flask App Setup ---
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Create cache directory if it doesn't exist ---
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

def get_transparent_tile():
    """Generate a transparent tile for areas with no data."""
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

def get_sample_tile(z, x, y):
    """Generate a sample tile with a simple grid pattern for testing."""
    # Create a blank RGBA image
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    
    # Draw a grid pattern based on the tile coordinates
    for i in range(0, 256, 32):
        for j in range(0, 256, 32):
            # Color based on coordinates to create a visible pattern
            color = (
                (x * 20 + i // 16) % 256,  # Red
                (y * 20 + j // 16) % 256,  # Green
                (z * 40) % 256,            # Blue
                100  # Alpha (semi-transparent)
            )
            # Draw a square
            for ii in range(i, min(i+30, 256)):
                for jj in range(j, min(j+30, 256)):
                    img.putpixel((ii, jj), color)
    
    # Convert to bytes for HTTP response
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

@app.route('/metadata', methods=['GET'])
def get_metadata():
    """Return mock metadata about the dataset."""
    metadata = {
        "min_zoom": 0,
        "max_zoom": 18,
        "bounds": {
            "north": 90,
            "south": -90,
            "east": 180,
            "west": -180
        },
        "value_range": {
            "min": 0,
            "max": 255
        },
        "status": "ok",
        "message": "Sample tile server (no actual satellite data loaded)"
    }
    return jsonify(metadata)

@app.route('/tiles/<int:z>/<int:x>/<int:y>', methods=['GET'])
def tile_server(z, x, y):
    """Serve sample map tiles."""
    logger.info(f"Tile request: z={z}, x={x}, y={y}")
    
    # Simple validation
    if z < 0 or z > 18:
        return Response("Invalid zoom level", status=400)
    
    # Return a sample tile
    tile_data = get_sample_tile(z, x, y)
    
    # Set headers
    headers = {
        'Content-Type': 'image/png',
        'Content-Disposition': f'inline; filename="tile_{z}_{x}_{y}.png"',
        'Cache-Control': 'public, max-age=86400'  # Cache for 24 hours
    }
    
    return Response(tile_data.getvalue(), headers=headers)

@app.route('/tiles/<path:tile_path>', methods=['GET'])
def tile_server_path(tile_path):
    """Handle tile requests with any path format."""
    parts = tile_path.split('/')
    if len(parts) < 3:
        return Response("Invalid tile path", status=400)
    
    try:
        z = int(parts[-3])
        x = int(parts[-2])
        y = int(parts[-1].split('.')[0])  # Remove file extension if present
    except ValueError:
        return Response("Invalid tile coordinates", status=400)
    
    return tile_server(z, x, y)

if __name__ == '__main__':
    logger.info(f"Starting simple tile server on port {SERVER_PORT}")
    app.run(host='127.0.0.1', port=SERVER_PORT, debug=True, threaded=True)
