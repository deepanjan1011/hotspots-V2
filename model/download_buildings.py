import osmnx as ox
import geopandas as gpd
import os
from pathlib import Path

from project_paths import SERVER_DATA_DIR, add_app_to_pythonpath

add_app_to_pythonpath()

from server.config import BBOX, CITY_NAME

def download_buildings():
    print(f"Downloading building footprints for {CITY_NAME}...")
    
    # Define bounding box (north, south, east, west)
    # config BBOX is (min_lon, min_lat, max_lon, max_lat)
    west, south, east, north = BBOX
    
    # Download buildings
    # ox.features_from_bbox is deprecated or ambiguous in newer versions regarding tuple order.
    # Using shapely box + features_from_polygon is safer and explicit: (minx, miny, maxx, maxy)
    from shapely.geometry import box
    geometry = box(west, south, east, north)
    
    tags = {'building': True}
    buildings = ox.features_from_polygon(geometry, tags=tags)
        
    if buildings.empty:
        print("No buildings found in the specified area.")
        return

    # Ensure correct CRS (EPSG:4326 for storage)
    if buildings.crs is None:
         buildings.set_crs(epsg=4326, inplace=True)
    else:
         buildings = buildings.to_crs(epsg=4326)

    # Filter out non-polygon geometries if any (points/lines shouldn't be here with 'building' tag usually, but safe to check)
    buildings = buildings[buildings.geometry.type.isin(['Polygon', 'MultiPolygon'])]

    # Select only relevant columns to keep file size manageable if needed, 
    # or just save minimal info. For density, we just need geometry.
    # But Shapefiles satisfy specific column constraints (length, types). 
    # Easier to just save geometry and maybe 'height' if available.
    cols = ['geometry']
    if 'height' in buildings.columns:
        cols.append('height')
    
    buildings = buildings[cols]

    # Define output path
    save_path = Path(SERVER_DATA_DIR) / f"{CITY_NAME.lower()}_buildings.shp"
    os.makedirs(save_path.parent, exist_ok=True)
    
    print(f"Saving {len(buildings)} buildings to {save_path}...")
    buildings.to_file(save_path)
    print("Done.")

if __name__ == "__main__":
    download_buildings()
