CITY_NAME = "New Delhi"
# (min_lon, min_lat, max_lon, max_lat)
# (min_lon, min_lat, max_lon, max_lat)
BBOX = (77.18, 28.52, 77.26, 28.66)

# Key Locations for Quick Search
LOCATIONS = [
    {"name": "Connaught Place", "coords": [28.6304, 77.2177]},
    {"name": "Hauz Khas Village", "coords": [28.5531, 77.1947]},
    {"name": "Chandni Chowk", "coords": [28.6506, 77.2303]},
    {"name": "Saket", "coords": [28.5246, 77.2185]},
    {"name": "Vasant Kunj", "coords": [28.5422, 77.1583]},
    {"name": "Dwarka", "coords": [28.5823, 77.0500]},
    {"name": "Karol Bagh", "coords": [28.6521, 77.1895]},
    {"name": "Lajpat Nagar", "coords": [28.5677, 77.2433]},
    {"name": "Rohini", "coords": [28.7160, 77.1160]},
    {"name": "Greater Kailash", "coords": [28.5482, 77.2372]},
    {"name": "India Gate", "coords": [28.6129, 77.2295]},
    {"name": "Lodhi Garden", "coords": [28.5933, 77.2212]},
    {"name": "Nehru Place", "coords": [28.5492, 77.2523]}
]

# Paths
DATA_DIR = "server/data"
LST_TIF = "server/data/new delhi_lst.tif"
NDVI_TIF = "server/data/new delhi_ndvi.tif"
# Note: For full functionality, you'd need the building shapefile for New York:
# BUILDING_SHP = "server/data/new_york_buildings.shp" 
# For now, it might reuse the Toronto one (which will result in 0 density), 
# or you can download OpenStreetMap buildings for NY. 
BUILDING_SHP = "server/data/new delhi_buildings.shp"
