"""
This script checks the VIIRS night lights GeoTIFF file to verify its content and geographical coverage.
"""
import rasterio
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LogNorm
import os
import gzip

# Path to the VIIRS night lights data
filepath = "SVDNB_npp_20250201-20250228_75N180W_vcmslcfg_v10_c202503122200.avg_rade9h.tif"

def decompress_gz(input_gz, output_tif):
    """Decompress a .gz file to .tif."""
    with gzip.open(input_gz, 'rb') as f_in:
        with open(output_tif, 'wb') as f_out:
            f_out.write(f_in.read())

# Example usage:
# decompress_gz(
#     "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif.gz",
#     "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif"
# )

print(f"Checking if file exists: {os.path.exists(filepath)}")

try:
    # Open the GeoTIFF file
    with rasterio.open(filepath) as src:
        # Print basic metadata
        print(f"File metadata:")
        print(f"  Driver: {src.driver}")
        print(f"  Width: {src.width}")
        print(f"  Height: {src.height}")
        print(f"  Bands: {src.count}")
        print(f"  CRS: {src.crs}")
        print(f"  Bounds: {src.bounds}")
        
        # Read the data
        data = src.read(1)
        print(f"Data shape: {data.shape}")
        
        # Basic statistics
        valid_data = data[data > 0]
        print(f"Total pixels: {data.size}")
        print(f"Valid pixels (> 0): {valid_data.size}")
        print(f"Percentage of valid data: {valid_data.size / data.size * 100:.2f}%")
        
        if valid_data.size > 0:
            print(f"Min value: {valid_data.min()}")
            print(f"Max value: {valid_data.max()}")
            print(f"Mean value: {valid_data.mean()}")
            
            # Sample values
            sample_size = min(10, valid_data.size)
            print(f"Sample values: {np.random.choice(valid_data, sample_size)}")
            
            # Create a simple visualization
            plt.figure(figsize=(10, 8))
            plt.imshow(np.log1p(data), cmap='viridis', norm=LogNorm(vmin=0.1, vmax=100))
            plt.colorbar(label='Log(Intensity + 1)')
            plt.title('VIIRS Night Lights - Logarithmic Scale')
            plt.savefig('viirs_data_visualization.png')
            print(f"Visualization saved to 'viirs_data_visualization.png'")
        else:
            print("WARNING: No valid data found in the file!")
            
except Exception as e:
    print(f"Error processing file: {e}")
