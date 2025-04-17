"""
Extract the compressed VIIRS night lights data file.
"""
import gzip
import os

def decompress_gz(input_gz, output_tif):
    """Decompress a .gz file to .tif."""
    print(f"Decompressing {input_gz} to {output_tif}...")
    with gzip.open(input_gz, 'rb') as f_in:
        with open(output_tif, 'wb') as f_out:
            f_out.write(f_in.read())
    print(f"Decompression complete. File size: {os.path.getsize(output_tif) / (1024*1024):.2f} MB")

# Input and output file paths
input_file = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif.gz"
output_file = "VNL_npp_2024_global_vcmslcfg_v2_c202502261200.average.dat.tif"

# Check if the input file exists
if not os.path.exists(input_file):
    print(f"Error: Input file {input_file} not found!")
    exit(1)

# Check if the output file already exists
if os.path.exists(output_file):
    print(f"Output file {output_file} already exists. Skipping decompression.")
else:
    # Decompress the file
    decompress_gz(input_file, output_file)

print(f"Extraction process completed. The file is ready to be used by the tile server.")
