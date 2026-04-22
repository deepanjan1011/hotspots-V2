#!/usr/bin/env python3
import json
import os
from project_paths import MODEL_DIR, SERVER_DATA_DIR

IN_GEOJSON  = SERVER_DATA_DIR / 'vulnerability_points.geojson'
OUT_GEOJSON = SERVER_DATA_DIR / 'tree_priority.geojson'
ARTIFACTS_FILE = MODEL_DIR / "model_artifacts.json"

# Load weights
if not os.path.exists(ARTIFACTS_FILE):
    print("Model artifacts not found. Using default weights.")
    w1, w2, w3 = 0.6, 0.2, 0.2
else:
    with open(ARTIFACTS_FILE, 'r') as f:
        artifacts = json.load(f)
        weights = artifacts.get("weights", {})
        w1 = weights.get("w1", 0.6)
        w2 = weights.get("w2", 0.2)
        w3 = weights.get("w3", 0.2)

delta_ndvi = 0.2

if not os.path.exists(IN_GEOJSON):
    print(f"Input file {IN_GEOJSON} not found. Please run generate_data.py first.")
    exit(1)

with open(IN_GEOJSON) as f:
    data = json.load(f)
features = data['features']

temps   = [feat['properties']['temp']       for feat in features]
ndvis   = [feat['properties']['ndvi']       for feat in features]
blds    = [feat['properties']['bldDensity'] for feat in features]
vuls    = [feat['properties']['vulnerability'] for feat in features]

def normalize(arr):
    if not arr: return []
    mn, mx = min(arr), max(arr)
    if mx == mn: return [0.5 for _ in arr]
    return [(v - mn)/(mx - mn) for v in arr]

nT, nN, nB = normalize(temps), normalize(ndvis), normalize(blds)

for i, feat in enumerate(features):
    V0 = vuls[i]
    n2 = min(nN[i] + delta_ndvi, 1.0)
    V1 = w1*nT[i] - w2*n2 + w3*nB[i]
    feat['properties']['plantPriority'] = float(V0 - V1)

out = {"type":"FeatureCollection","features":features}
with open(OUT_GEOJSON, 'w') as f:
    json.dump(out, f, indent=2)

print(f"Wrote {OUT_GEOJSON} with plantPriority for {len(features)} points.")
