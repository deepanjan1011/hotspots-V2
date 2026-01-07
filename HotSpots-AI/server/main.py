# HotSpots AI Backend
import os
import json
from dotenv import load_dotenv

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
    # Since we don't have real granular data for these, we mock them for visualization.
    import random
    random.seed(42) # Ensure consistency across reloads

    for feature in data['features']:
        # Mock AQI (Delhi is usually 100-500)
        # We correlate it slightly with vulnerability for realism (hotter areas ~ worse air stagnation)
        base_aqi = 200
        vuln_factor = feature['properties'].get('vulnerability', 0.5) * 200
        noise = random.randint(-50, 50)
        feature['properties']['aqi'] = int(base_aqi + vuln_factor + noise)
        
        # Mock Population Density (people per sq km equivalent for this grid)
        # Random distribution 
        feature['properties']['pop'] = random.randint(5000, 60000)

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
