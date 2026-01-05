import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .config import CITY_NAME, BBOX, LOCATIONS

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

@app.get("/api/config")
async def get_config():
    return {
        "city_name": CITY_NAME,
        "bbox": BBOX,
        "initial_view": {
            "longitude": (BBOX[0] + BBOX[2]) / 2,
            "latitude": (BBOX[1] + BBOX[3]) / 2,
            "zoom": 12
        },
        "locations": LOCATIONS
    }

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/vulnerability-points")
async def get_vulnerability_points():
    file_path = os.path.join(DATA_DIR, "vulnerability_points.geojson")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Vulnerability data not found. Please run data generation.")
    
    with open(file_path, "r") as f:
        data = json.load(f)
    return data



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
