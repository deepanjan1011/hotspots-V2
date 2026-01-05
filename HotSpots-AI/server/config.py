# Location Configuration
# # Default: Toronto
# CITY_NAME = "Toronto"
# # Bounding Box: (min_lon, min_lat, max_lon, max_lat)
# BBOX = (-79.6393, 43.4955, -79.1152, 43.8555)

# Example: New Delhi, India
CITY_NAME = "New Delhi"
# (min_lon, min_lat, max_lon, max_lat)
BBOX = (77.18, 28.52, 77.26, 28.66) 

# Paths
DATA_DIR = "server/data"
LST_TIF = "server/data/new delhi_lst.tif"
NDVI_TIF = "server/data/new delhi_ndvi.tif"
# Note: For full functionality, you'd need the building shapefile for New York:
# BUILDING_SHP = "server/data/new_york_buildings.shp" 
# For now, it might reuse the Toronto one (which will result in 0 density), 
# or you can download OpenStreetMap buildings for NY. 
BUILDING_SHP = "server/data/new delhi_buildings.shp"
