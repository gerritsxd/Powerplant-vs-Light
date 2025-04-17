# Global Power Plant Visualization Project

An interactive web application for visualizing and analyzing global power plant data with a focus on geographical distribution, energy mix analysis, and light pollution correlation.

## Features

- **Interactive Map**: Visualize global power plants with color-coded markers based on fuel type and size based on capacity
- **Statistics Dashboard**: Perform advanced statistical analysis including correlation, regression, and distribution analysis
- **Country Specifications**: Analyze country-specific energy profiles with detailed breakdowns of energy mix
- **Light Pollution Analysis**: Explore the relationship between power plants and nighttime light intensity
- **Dark/Light Theme**: Support for both dark and light mode viewing

## Project Structure

```
global-power-plant-visualization/
├── index.html                  # Main map visualization page
├── stats.html                  # Statistical analysis page
├── specs.html                  # Country specifications page
├── landing.html               # Project landing page
├── script.js                   # Main map visualization JavaScript
├── statistics.js               # Statistical analysis JavaScript
├── specs.js                    # Country specifications JavaScript
├── style.css                   # Global CSS styles
├── statistics.css              # Statistics page specific styles
├── specs.css                   # Specifications page specific styles
├── landing.css                 # Landing page specific styles
├── light_tile_server.py        # Python tile server for light pollution data
├── globalpowerplantdatabasev130/
│   └── global_power_plant_database.csv  # Power plant dataset
└── night_light_data/           # Folder for light pollution dataset (to be downloaded)
```

## Setup Instructions

### Prerequisites

- Web browser (Chrome, Firefox, Edge recommended)
- Python 3.6+ (for the light tile server)
- Git (optional, for cloning the repository)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/global-power-plant-visualization.git
   cd global-power-plant-visualization
   ```

2. Download the Global Power Plant Database:
   - The dataset is included in the repository under `globalpowerplantdatabasev130/`
   - If needed, you can download the latest version from [World Resources Institute](https://datasets.wri.org/dataset/globalpowerplantdatabase)

3. Download the Night Light Data:
   - Download the Earth at Night dataset from [NASA Earth Observatory](https://earthobservatory.nasa.gov/features/NightLights)
   - Alternatively, you can use the [NASA Visible Earth](https://visibleearth.nasa.gov/collection/1484/visible-earth-night-lights) collection
   - Place the downloaded data in the `night_light_data/` directory
   - Recommended file: "Black Marble: Earth at Night" image collection

4. Install Python dependencies:
   ```
   pip install flask numpy pillow rasterio
   ```

### Running the Application

1. Start the light tile server:
   ```
   python light_tile_server.py
   ```

2. Launch a simple HTTP server:
   - For Python 3:
     ```
     python -m http.server 8000
     ```
   - For Python 2:
     ```
     python -m SimpleHTTPServer 8000
     ```

3. Open your browser and navigate to:
   ```
   http://localhost:8000/landing.html
   ```

## Data Sources

- **Global Power Plant Database**: A comprehensive, open-source database of power plants around the world. It centralizes power plant data to make it easier to navigate, compare, and draw insights. Available from [World Resources Institute](https://datasets.wri.org/dataset/globalpowerplantdatabase).

- **Earth at Night (Black Marble)**: NASA's night lights data provides a global composite view of the Earth at night, assembled from data acquired by the Suomi National Polar-orbiting Partnership (Suomi NPP) satellite. Available from [NASA Earth Observatory](https://earthobservatory.nasa.gov/features/NightLights).

## Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- World Resources Institute for the Global Power Plant Database
- NASA Earth Observatory for the night light imagery
- All contributors and supporters of open data initiatives
