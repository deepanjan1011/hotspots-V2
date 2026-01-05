import osmnx as ox
import geopandas as gpd
import sys
import os

# Add project root to sys.path to allow importing server.config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.config import BBOX, CITY_NAME, DATA_DIR

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
    output_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # Project Root
    save_path = os.path.join(DATA_DIR, f"{CITY_NAME.lower()}_buildings.shp")
    
    # Resolve absolute path for save
    if not os.path.isabs(save_path):
         save_path = os.path.join(output_dir, save_path)

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    print(f"Saving {len(buildings)} buildings to {save_path}...")
    buildings.to_file(save_path)
    print("Done.")
        
    print("\nIMPORTANT: Update your server/config.py with:")
    print(f'BUILDING_SHP = "{save_path}"')

if __name__ == "__main__":
    download_buildings()
