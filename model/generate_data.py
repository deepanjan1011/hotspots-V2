#!/usr/bin/env python3
import json
import os
import random
import rasterio
import geopandas as gpd
import numpy as np
from shapely.geometry import Point

import sys

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# Add project root to sys.path to allow importing server.config
sys.path.append(PROJECT_ROOT)

from server.config import LST_TIF, NDVI_TIF, BUILDING_SHP, DATA_DIR, BBOX

# Resolve paths relative to PROJECT_ROOT if they are relative
def resolve_path(path):
    if os.path.isabs(path):
        return path
    return os.path.join(PROJECT_ROOT, path)

LST_TIF_PATH = resolve_path(LST_TIF)
NDVI_TIF_PATH = resolve_path(NDVI_TIF)
BUILD_SHP_PATH = resolve_path(BUILDING_SHP)
OUTPUT_DIR = resolve_path(DATA_DIR)

ARTIFACTS_FILE = os.path.join(BASE_DIR, "model_artifacts.json")
OUTPUT_GEOJSON = os.path.join(OUTPUT_DIR, 'vulnerability_points.geojson')

# Load weights
if not os.path.exists(ARTIFACTS_FILE):
    print("Model artifacts not found. Using default weights.")
    W1, W2, W3 = 0.6, 0.2, 0.2
else:
    with open(ARTIFACTS_FILE, 'r') as f:
        artifacts = json.load(f)
        weights = artifacts.get("weights", {})
        W1 = weights.get("w1", 0.6)
        W2 = weights.get("w2", 0.2)
        W3 = weights.get("w3", 0.2)
    print(f"Loaded weights: w1={W1}, w2={W2}, w3={W3}")

# Constants
bbox = BBOX
N_POINTS = 1500   

if not os.path.exists(BUILD_SHP_PATH):
    print(f"WARNING: Shapefile not found at {BUILD_SHP_PATH}")
    print("Proceeding WITHOUT building density data (will be 0).")
    buildings = None
else:
    print("Loading building footprints…")
    buildings = (
        gpd.read_file(BUILD_SHP_PATH)
           .to_crs(epsg=3857) 
    )
    print(f"Loaded {len(buildings)} building polygons.")

print("Loading rasters…")
lst_src  = rasterio.open(LST_TIF_PATH)
ndvi_src = rasterio.open(NDVI_TIF_PATH)



print(f"Generating {N_POINTS} random points…")
minx, miny, maxx, maxy = bbox
points = []
for _ in range(N_POINTS):
    lon = random.uniform(minx, maxx)
    lat = random.uniform(miny, maxy)
    points.append((lon, lat))

temps, ndvis, blds = [], [], []
features = []

print("Sampling metrics for each point…")
for lon, lat in points:
    try:
        temp = next(lst_src.sample([(lon, lat)]))[0]
        ndvi = next(ndvi_src.sample([(lon, lat)]))[0]

        pt = gpd.GeoSeries([Point(lon, lat)], crs='EPSG:4326')\
                 .to_crs(epsg=3857)
        if buildings is not None:
            circle = pt.buffer(100).iloc[0]
            pts_build = buildings[buildings.intersects(circle)]
            area_sum  = pts_build.geometry.intersection(circle).area.sum()
            density   = float(area_sum / circle.area)
        else:
            density = 0.0

        if ndvi < 0.0:
            continue

        temps.append(float(temp))
        ndvis.append(float(ndvi))
        blds.append(density)

        features.append({
          "type": "Feature",
          "geometry": { "type": "Point", "coordinates": [lon, lat] },
          "properties": {
            "temp": float(temp),
            "ndvi": float(ndvi),
            "bldDensity": density
          }
        })
    except Exception as e:
        print(f"Skipping point ({lon}, {lat}): {e}")
        continue



print("Normalizing metrics and computing vulnerability…")
def normalize(arr):
    if not arr: return []
    mn, mx = min(arr), max(arr)
    if mx == mn: return [0.5 for _ in arr]
    return [(v - mn)/(mx - mn) for v in arr]

nT = normalize(temps)
nN = normalize(ndvis)
nB = normalize(blds)

for i, feat in enumerate(features):
    V = W1*nT[i] - W2*nN[i] + W3*nB[i]
    feat["properties"]["vulnerability"] = float(V)

os.makedirs(OUTPUT_DIR, exist_ok=True)
print(f"Writing {len(features)} features to {OUTPUT_GEOJSON} …")
geojson = { "type": "FeatureCollection", "features": features }
with open(OUTPUT_GEOJSON, 'w') as f:
    json.dump(geojson, f, indent=2)

print("Done!")
