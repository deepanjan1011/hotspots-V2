# HotSpots AI Backend
import os
import json
from dotenv import load_dotenv
import joblib
import numpy as np

load_dotenv() # Load environment variables from .env file

from pydantic import BaseModel
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

from fastapi.responses import Response
from azure_services import generate_heat_plan, text_to_speech, chat_with_expert

from config import CITY_NAME, BBOX, LOCATIONS

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Load Random Forest Model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
rf_model = None

if os.path.exists(MODEL_PATH):
    try:
        rf_model = joblib.load(MODEL_PATH)
        print(f"Loaded ML Model from {MODEL_PATH}")
    except Exception as e:
        print(f"Failed to load model: {e}")
else:
    print("Model file not found. Running in heuristic mode.")

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
    
    # Inject mock data for "Option 3" (AQI, Population, Health Risk)
    # NOTE: "Vulnerability" is NOT modified here. It remains pure from the GeoJSON.
    import random
    random.seed(42) # Ensure consistency

    # [OPTIMIZATION] Prepare batch data for ML model
    ms_inputs = [] 
    
    for feature in data['features']:
        props = feature['properties']
        bld = props.get('bld_density', 0)
        ndvi = props.get('ndvi', 0)
        temp = props.get('temp', 30)
        
        # Prepare input for batch prediction
        if rf_model:
            ms_inputs.append([temp, ndvi, bld])

        # Mock AQI: Higher in dense areas, lower in green areas
        # Chennai baseline ~200. +150 for dense urban. -100 for forests.
        # FIX: Added significant noise (randomness) to break up artificial "blocks" of color.
        base_aqi = 200 + (bld * 150) - (ndvi * 100)
        
        # Add "Organic" variance: some random spots are cleaner/dirtier
        organic_factor = random.choice([-40, 0, 0, 40]) # 25% chance of deviation
        noise = random.randint(-40, 40) 
        
        final_aqi = base_aqi + noise + organic_factor
        props['aqi'] = max(50, min(500, int(final_aqi)))
        
        
        # [IMPROVED REALISM] Population
        # Old way: bld * 80000 (too linear)
        # New way: "Zoning" logic. 
        # Some high density areas are offices (low night pop), some are slums/apartments (high night pop).
        
        # 1. Determine "Zone Type" randomly based on density
        if bld > 0.7:
             # High density: 50% chance of being Commercial (Lower pop) vs Residential (High pop)
            is_commercial = random.choice([True, False])
            pop_factor = 40000 if is_commercial else 120000
        else:
            # Low density: Usually residential
            pop_factor = 60000

        # 2. Add organic noise (Standard Deviation)
        # This makes it look like real census data (not a smooth gradient)
        noise = random.randint(-15000, 15000)
        final_pop = (bld * pop_factor) + noise
        props['pop'] = int(max(500, final_pop)) # Floor at 500

    # [OPTIMIZATION] Run Batch Prediction (1 call instead of 2000)
    if rf_model and len(ms_inputs) > 0:
        predictions = rf_model.predict(ms_inputs)
        for i, pred in enumerate(predictions):
            vuln_score = float(pred)
            data['features'][i]['properties']['vulnerability'] = vuln_score
            
            # [IMPROVED REALISM] Health Risk
            # Risk isn't just Heat + Pollution. It also depends on "Vulnerable Population" (Age, Income).
            # We simulate a "Social Vulnerability Index" causing random high-risk clusters.
            
            # [IMPROVED REALISM] Health Risk v5 (Chennai Specific)
            # Context: Chennai has high AQI and consistent heat.
            # Logic: 
            # 1. High AQI (>300) = AUTOMATIC SEVERE RISK (Red)
            # 2. High Density (>0.8) + Heat = AUTOMATIC HIGH RISK (Orange/Red)
            # 3. Random "Outbreaks" (10%) for variation.
            
            aqi_val = data['features'][i]['properties']['aqi']
            
            if aqi_val > 300:
                # Chennai Poisonous Air -> Severe Risk
                 final_risk = 0.95 + random.uniform(0, 0.05)
            elif bld > 0.8 and vuln_score > 0.6:
                # Dense Slums/Urban Heat Island -> High Risk
                final_risk = 0.85 + random.uniform(0, 0.1)
            elif random.random() < 0.10:
                # Random sporadic issues (10% chance)
                final_risk = 0.90
            else:
                # Normal variation
                aqi_norm = aqi_val / 500.0
                base_risk = 0.3 + (vuln_score * 0.4) + (aqi_norm * 0.3)
                final_risk = min(0.7, base_risk) # Cap normal risk at Orange
            
            # Normalize
            data['features'][i]['properties']['health_risk'] = max(0.1, min(1.0, final_risk))

    return data





class PlanRequest(BaseModel):
    vulnerability: float
    bldDensity: float
    ndvi: float
    city: str = CITY_NAME

@app.post("/api/generate-plan")
async def api_generate_plan(request: PlanRequest):
    return generate_heat_plan(request.dict())

class SpeakRequest(BaseModel):
    text: str

@app.post("/api/speak-plan")
async def api_speak_plan(request: SpeakRequest):
    audio_data = text_to_speech(request.text)
    return Response(content=audio_data, media_type="audio/wav")

from typing import List, Dict, Any, Optional

class ChatRequest(BaseModel):
    message: str
    history: List[Dict[str, str]] = [] # [{"role": "user", "content": "..."}]
    context: Optional[Dict[str, Any]] = None

@app.post("/api/chat")
async def api_chat_expert(request: ChatRequest):
    response = chat_with_expert(request.message, request.history, request.context)
    return {"reply": response}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
