# Power Plant Visualization Project

An interactive web application for visualizing global power plant data and analyzing correlations with geographic information.

## Features

- **Interactive Map**: Visualize global power plants with filtering capabilities
- **Statistical Analysis**: Analyze power plant data through charts and statistical tools
- **Country Specifications**: View detailed energy profiles by country
- **User Analytics**: Comprehensive tracking of user interactions

## Project Structure

- `index.html`, `map.html`, `statistics.html`, `specs.html` - Main web pages
- `style.css`, `landing.css`, `statistics.css`, `specs.css` - Styling
- `script.js`, `statistics.js`, `specs.js` - Core functionality
- `enhanced_analytics.js` - User interaction tracking
- `log_server.py` - Web server with built-in logging
- `simple_tile_server.py` - Map tile server
- `global_power_plant_database.csv` - Power plant data

## Setup

1. Install dependencies:
```
pip install -r requirements.txt
```

2. Start the map tile server:
```
python simple_tile_server.py
```

3. Start the web server:
```
python log_server.py
```

4. Access the website at http://localhost:8888

## User Analytics

The project includes built-in user interaction tracking. All user activities are logged to the `session_logs` directory, organized by session ID.

## Data Source

This project uses the [Global Power Plant Database](https://datasets.wri.org/dataset/globalpowerplantdatabase) from the World Resources Institute.

## License

This project is provided for educational and research purposes.
