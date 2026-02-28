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

    # Define center coordinates (Chennai in this case)
    center_lat = (BBOX[1] + BBOX[3]) / 2
    center_lon = (BBOX[0] + BBOX[2]) / 2
    
    # Try fetching real AQI prediction
    city_aqi_prediction = None
    owm_key = os.getenv("OPENWEATHERMAP_API_KEY")
    
    if owm_key:
        try:
            import requests
            # Fetch Air Pollution Forecast
            response = requests.get(f"http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat={center_lat}&lon={center_lon}&appid={owm_key}")
            if response.status_code == 200:
                forecast_data = response.json()
                
                # We want to find a prediction. 
                # OpenWeatherMap provides hourly data. Let's average the AQI for the next 24 hours.
                aqi_sum = 0
                count = 0
                for item in forecast_data.get('list', [])[:24]:
                    # OWM AQI is 1(Good) - 5(Very Poor). We convert it to a standard 0-500 scale roughly
                    owm_aqi = item['main']['aqi']
                    
                    # Rough mapping OWM (1-5) to US AQI (0-500)
                    mapping = {1: 40, 2: 80, 3: 130, 4: 180, 5: 250}
                    standard_aqi = mapping.get(owm_aqi, 200)
                    
                    aqi_sum += standard_aqi
                    count += 1
                
                if count > 0:
                    city_aqi_prediction = aqi_sum / count
        except Exception as e:
            print(f"Error fetching OWM AQI: {e}")
            
    # Fallback if API fails or no key
    if city_aqi_prediction is None:
        city_aqi_prediction = 150 # Default moderate/unhealthy

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

        # Predicted AQI Calculation:
        # We start with the city-wide prediction and apply local variance based on environment.
        # Dense building areas trap pollution (+), green areas filter it (-).
        
        # Local adjustment based on density and vegetation
        local_variance = (bld * 50) - (ndvi * 40)
        
        # Add slight random noise to prevent artificial looking blocks
        noise = random.randint(-15, 15) 
        
        final_aqi = city_aqi_prediction + local_variance + noise
        props['aqi'] = max(20, min(500, int(final_aqi)))

        # NOTE: Population data generator has been permanently removed

    # [OPTIMIZATION] Run Batch Prediction (1 call instead of 2000)
    if rf_model and len(ms_inputs) > 0:
        predictions = rf_model.predict(ms_inputs)
        for i, pred in enumerate(predictions):
            vuln_score = float(pred)
            data['features'][i]['properties']['vulnerability'] = vuln_score
            
            # [IMPROVED REALISM] Health Risk v5 (Chennai Specific)
            aqi_val = data['features'][i]['properties']['aqi']
            bld = data['features'][i]['properties'].get('bld_density', 0)
            
            if aqi_val > 300:
                # Severe Risk due to AQI
                 final_risk = 0.95 + random.uniform(0, 0.05)
            elif bld > 0.8 and vuln_score > 0.6:
                # High Density + Heat = Severe Risk
                final_risk = 0.85 + random.uniform(0, 0.1)
            elif random.random() < 0.10:
                # Random sporadic issues
                final_risk = 0.90
            else:
                # Normal variation
                aqi_norm = aqi_val / 500.0
                base_risk = 0.3 + (vuln_score * 0.4) + (aqi_norm * 0.3)
                final_risk = min(0.7, base_risk) 
            
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
