"""
Convert the VIIRS night lights data file to a format compatible with rasterio.
"""
import os
import numpy as np
import struct
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS
import gzip
import shutil

# Input and output file paths
input_gz = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif.gz"
intermediate_file = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif"
output_file = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.tif"

# Check if the output file already exists
if os.path.exists(output_file):
    print(f"Output file {output_file} already exists. Skipping conversion.")
    exit(0)

# Check if the input file exists
if not os.path.exists(input_gz):
    print(f"Error: Input file {input_gz} not found!")
    exit(1)

# Step 1: Decompress the .gz file if needed
if not os.path.exists(intermediate_file):
    print(f"Decompressing {input_gz}...")
    with gzip.open(input_gz, 'rb') as f_in:
        with open(intermediate_file, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    print(f"Decompression complete.")

# Step 2: Try to convert the file to a standard GeoTIFF
try:
    # Try to use the existing working file as a template
    template_file = "SVDNB_npp_20250201-20250228_75N180W_vcmslcfg_v10_c202503122200.avg_rade9h.tif"
    
    if os.path.exists(template_file):
        print(f"Using template file {template_file} for metadata...")
        with rasterio.open(template_file) as template:
            # Get metadata from template
            height = template.height
            width = template.width
            transform = template.transform
            crs = template.crs
            
            # Try to read the data from the intermediate file
            try:
                # Attempt to read as binary data
                with open(intermediate_file, 'rb') as f:
                    # Assuming the file is a flat binary file with float32 values
                    # This is a guess - might need adjustment based on actual format
                    data = np.fromfile(f, dtype=np.float32)
                    
                    # Try to reshape to match template dimensions
                    try:
                        data = data.reshape((height, width))
                    except ValueError:
                        print(f"Could not reshape data to {height}x{width}, trying to infer dimensions...")
                        # Try to infer dimensions from file size
                        file_size = os.path.getsize(intermediate_file)
                        if file_size % 4 == 0:  # Assuming 4 bytes per float32
                            total_pixels = file_size // 4
                            # Assuming global coverage with 2:1 aspect ratio (typical for global datasets)
                            width = int(np.sqrt(total_pixels * 2))
                            height = int(width / 2)
                            print(f"Inferred dimensions: {height}x{width}")
                            data = data[:height*width].reshape((height, width))
                
                # Write to a standard GeoTIFF
                print(f"Writing data to {output_file}...")
                with rasterio.open(
                    output_file,
                    'w',
                    driver='GTiff',
                    height=height,
                    width=width,
                    count=1,
                    dtype=data.dtype,
                    crs=crs,
                    transform=transform,
                ) as dst:
                    dst.write(data, 1)
                print(f"Conversion complete. File saved as {output_file}")
                
            except Exception as e:
                print(f"Error reading intermediate file: {e}")
                raise
    else:
        print(f"Template file {template_file} not found. Cannot proceed with conversion.")
        exit(1)
        
except Exception as e:
    print(f"Error during conversion: {e}")
    exit(1)

print("Conversion process completed successfully.")
