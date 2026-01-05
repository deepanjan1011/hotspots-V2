
import json
import random
import os
import rasterio
import geopandas as gpd
import numpy as np
from shapely.geometry import Point, shape

# Data Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "server/data")

LST_PATH = os.path.join(DATA_DIR, "new delhi_lst.tif")
NDVI_PATH = os.path.join(DATA_DIR, "new delhi_ndvi.tif")
BUILDINGS_PATH = os.path.join(DATA_DIR, "new delhi_buildings.shp")

OUTPUT_PATH_BACKEND = os.path.join(DATA_DIR, "vulnerability_points.geojson")
OUTPUT_PATH_FRONTEND = os.path.join(BASE_DIR, "HotSpots-AI/public/vulnerability_points.geojson")

# New Delhi Bounding Box (Approximate, to focus sampling)
MIN_LON, MIN_LAT = 77.10, 28.50
MAX_LON, MAX_LAT = 77.30, 28.70

def generate_real_delhi_data(n_points=2000):
    print("Loading datasets...")
    
    # Load Rasters
    try:
        lst_src = rasterio.open(LST_PATH)
        ndvi_src = rasterio.open(NDVI_PATH)
        print(" - Loaded Rasters")
    except Exception as e:
        print(f"Error loading rasters: {e}")
        return

    # Load Buildings (reproject to match rasters if needed, usually EPSG:4326 for GeoJSON)
    # We will use EPSG:3857 (meters) for accurate buffering/distance checks, then convert back
    try:
        buildings = gpd.read_file(BUILDINGS_PATH).to_crs(epsg=3857)
        print(f" - Loaded {len(buildings)} Buildings")
    except Exception as e:
        print(f"Error loading buildings: {e}")
        return

    print(f"Generating {n_points} random points...")
    
    features = []
    
    # We need to ensure points are within the raster bounds
    # lst_src.bounds gives (left, bottom, right, top)
    # But usually we want to stick to our defined Delhi bbox, interacting with raster bounds
    
    # For safety, we will just try to sample until we get valid data
    count = 0
    attempts = 0
    max_attempts = n_points * 5
    
    # Weights for Vulnerability Formula
    W_TEMP = 0.5
    W_NDVI = 0.3
    W_DENS = 0.2
    
    # Pre-calculate normalization constants (approximate based on Delhi summer)
    MIN_TEMP, MAX_TEMP = 25.0, 50.0 # LST in Celsius
    
    while count < n_points and attempts < max_attempts:
        attempts += 1
        
        lon = random.uniform(MIN_LON, MAX_LON)
        lat = random.uniform(MIN_LAT, MAX_LAT)
        
        # Sample Raster Values
        try:
            # rasterio.sample expects list of (x, y)
            # Returns generator
            val_lst = next(lst_src.sample([(lon, lat)]))[0]
            val_ndvi = next(ndvi_src.sample([(lon, lat)]))[0]
            
            # Check for NoData or invalid values (often -9999 or extremely low/high)
            if val_lst < -100 or val_lst > 100: # Simple validity check for Celsius
                continue
            if val_ndvi < -1 or val_ndvi > 1:
                continue
                
        except IndexError:
            continue # Point likely outside raster bounds
            
        # Calculate Building Density
        # Create a point, project to meters, buffer 100m, check intersection ratio
        pt_geo = gpd.GeoSeries([Point(lon, lat)], crs="EPSG:4326").to_crs(epsg=3857)
        circle = pt_geo.buffer(100).iloc[0] # 100 meter radius buffer
        
        # Spatial Index query for speed
        possible_matches_index = list(buildings.sindex.intersection(circle.bounds))
        possible_matches = buildings.iloc[possible_matches_index]
        precise_matches = possible_matches[possible_matches.intersects(circle)]
        
        if not precise_matches.empty:
             # Calculate intersection area
             intersection_area = precise_matches.intersection(circle).area.sum()
             bld_density = intersection_area / circle.area
        else:
            bld_density = 0.0
            
        bld_density = float(min(1.0, max(0.0, bld_density)))

        # Normalize metrics for Vulnerability Score
        norm_temp = (val_lst - MIN_TEMP) / (MAX_TEMP - MIN_TEMP)
        norm_temp = min(1.0, max(0.0, norm_temp))
        
        norm_ndvi = (val_ndvi + 1) / 2 # NDVI is -1 to 1, map to 0 to 1
        # Invert NDVI because High Vegetation = Low Vulnerability
        # Actually logic is V = T - N + B. 
        # So we just use raw NDVI for formula relation: High NDVI reduces V.
        # But for 0-1 range calculation:
        # Let's stick to the previous simple heuristic normalized logic
        # V = 0.5 * NormTemp + 0.3 * (1 - NormNDVI) + 0.2 * NormDensity
        
        # Re-normalizing NDVI to 0-1 range where 1 is "good" (dense veg)
        ndvi_0_1 = (val_ndvi - (-0.1)) / (0.8 - (-0.1)) # approximate bounds
        ndvi_0_1 = min(1.0, max(0.0, ndvi_0_1))
        
        vuln = (W_TEMP * norm_temp) + (W_NDVI * (1.0 - ndvi_0_1)) + (W_DENS * bld_density)
        vuln = min(1.0, max(0.0, vuln))

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": {
                "temp": float(round(val_lst, 2)),
                "ndvi": float(round(val_ndvi, 3)),
                "bldDensity": float(round(bld_density, 3)),
                "vulnerability": float(round(vuln, 3))
            }
        }
        features.append(feature)
        count += 1
        
        if count % 100 == 0:
            print(f" ... generated {count} points")

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Save files
    os.makedirs(os.path.dirname(OUTPUT_PATH_BACKEND), exist_ok=True)
    with open(OUTPUT_PATH_BACKEND, "w") as f:
        json.dump(geojson, f, indent=2)
        
    os.makedirs(os.path.dirname(OUTPUT_PATH_FRONTEND), exist_ok=True)
    with open(OUTPUT_PATH_FRONTEND, "w") as f:
        json.dump(geojson, f, indent=2)
        
    print(f"Injected {len(features)} REAL data points.")
    print(f"Backend: {OUTPUT_PATH_BACKEND}")
    print(f"Frontend: {OUTPUT_PATH_FRONTEND}")

if __name__ == "__main__":
    generate_real_delhi_data()
