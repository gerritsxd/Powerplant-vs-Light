"""
Process the large VIIRS night lights data file and prepare it for use with the tile server.
This script handles the specific format of the VNL_npp_2024_global_vcmslcfg_v2 data.
"""
import os
import gzip
import shutil
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
import time
import sys

# Input and output file paths
INPUT_GZ = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif.gz"
EXTRACTED_DAT = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif"
OUTPUT_TIFF = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.processed.tif"

# Check if the output file already exists
if os.path.exists(OUTPUT_TIFF):
    print(f"Output file {OUTPUT_TIFF} already exists.")
    sys.exit(0)

# Check if the input file exists
if not os.path.exists(INPUT_GZ):
    print(f"Error: Input file {INPUT_GZ} not found!")
    sys.exit(1)

# Step 1: Extract the .gz file if needed
if not os.path.exists(EXTRACTED_DAT):
    print(f"Extracting {INPUT_GZ}...")
    start_time = time.time()
    try:
        with gzip.open(INPUT_GZ, 'rb') as f_in:
            with open(EXTRACTED_DAT, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        print(f"Extraction completed in {time.time() - start_time:.2f} seconds.")
    except Exception as e:
        print(f"Error during extraction: {e}")
        sys.exit(1)
else:
    print(f"Using previously extracted file: {EXTRACTED_DAT}")

# Step 2: Process the extracted file
# For VNL (Visible Night Lights) data, we need to handle the specific format
# This is typically a binary file with a specific structure

print(f"Processing {EXTRACTED_DAT}...")
start_time = time.time()

try:
    # Get file size to estimate dimensions
    file_size = os.path.getsize(EXTRACTED_DAT)
    print(f"File size: {file_size / (1024*1024*1024):.2f} GB")
    
    # Attempt to open with rasterio directly first
    try:
        with rasterio.open(EXTRACTED_DAT) as src:
            print(f"File opened successfully with rasterio!")
            print(f"Shape: {src.shape}")
            print(f"Bounds: {src.bounds}")
            print(f"CRS: {src.crs}")
            
            # Create a copy with standard GeoTIFF format
            with rasterio.open(
                OUTPUT_TIFF,
                'w',
                driver='GTiff',
                height=src.height,
                width=src.width,
                count=src.count,
                dtype=src.dtypes[0],
                crs=src.crs,
                transform=src.transform,
            ) as dst:
                # Read and write in chunks to avoid memory issues
                window_size = 1024
                for i in range(0, src.height, window_size):
                    for j in range(0, src.width, window_size):
                        # Define the window
                        window = rasterio.windows.Window(
                            j, i, 
                            min(window_size, src.width - j),
                            min(window_size, src.height - i)
                        )
                        # Read data from window
                        data = src.read(1, window=window)
                        # Write data to the same window
                        dst.write(data, 1, window=window)
                        
                        # Print progress
                        progress = (i * src.width + j * window_size) / (src.height * src.width) * 100
                        print(f"Progress: {progress:.2f}%", end='\r')
            
            print(f"\nProcessing completed in {time.time() - start_time:.2f} seconds.")
            print(f"Output file saved as {OUTPUT_TIFF}")
            
    except Exception as e:
        print(f"Could not open with rasterio directly: {e}")
        print("Attempting to process as raw binary data...")
        
        # For VNL data, we need to know the exact format
        # This is a placeholder - you may need to adjust based on the actual data format
        try:
            # Assuming the file is a flat binary file with float32 values
            # and global coverage at 15 arc-second resolution
            # Global coverage at 15 arc-seconds: 43200 x 21600 (360° x 180° with 15" resolution)
            width = 43200
            height = 21600
            
            # Create a memory-mapped array to avoid loading the entire file
            data = np.memmap(EXTRACTED_DAT, dtype=np.float32, mode='r', shape=(height, width))
            
            # Create a GeoTIFF with the correct georeference
            transform = from_origin(-180.0, 90.0, 15/3600, 15/3600)  # 15 arc-seconds in degrees
            
            with rasterio.open(
                OUTPUT_TIFF,
                'w',
                driver='GTiff',
                height=height,
                width=width,
                count=1,
                dtype=np.float32,
                crs=CRS.from_epsg(4326),  # WGS84
                transform=transform,
                compress='lzw',  # Use compression to reduce file size
                tiled=True,
                blockxsize=256,
                blockysize=256
            ) as dst:
                # Write data in chunks to avoid memory issues
                chunk_size = 1024
                for i in range(0, height, chunk_size):
                    for j in range(0, width, chunk_size):
                        # Define the chunk
                        i_end = min(i + chunk_size, height)
                        j_end = min(j + chunk_size, width)
                        
                        # Read chunk from memory-mapped array
                        chunk = data[i:i_end, j:j_end]
                        
                        # Write chunk to output file
                        dst.write(chunk, 1, window=rasterio.windows.Window(j, i, j_end-j, i_end-i))
                        
                        # Print progress
                        progress = (i * width + j * chunk_size) / (height * width) * 100
                        print(f"Progress: {progress:.2f}%", end='\r')
            
            print(f"\nProcessing completed in {time.time() - start_time:.2f} seconds.")
            print(f"Output file saved as {OUTPUT_TIFF}")
            
        except Exception as e:
            print(f"Error processing as raw binary: {e}")
            sys.exit(1)
            
except Exception as e:
    print(f"Error during processing: {e}")
    sys.exit(1)

print("Processing complete. The file is ready to be used by the tile server.")
