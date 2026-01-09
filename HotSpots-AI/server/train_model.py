import json
import os
import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "data", "vulnerability_points.geojson")
MODEL_FILE = os.path.join(BASE_DIR, "model.pkl")

def train_model():
    print(f"Loading data from {DATA_FILE}...")
    
    if not os.path.exists(DATA_FILE):
        print(f"Error: {DATA_FILE} not found.")
        return

    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    
    features = []
    targets = []
    
    print("Extracting features and generating synthetic ground truth...")
    
    for feature in data['features']:
        props = feature['properties']
        
        # Extract Features
        # Ensure we handle missing values gracefully
        temp = props.get('temp', 0)
        ndvi = props.get('ndvi', 0)
        bld_density = props.get('bldDensity', 0)
        
        # Feature Vector: [Temperature, NDVI, BuildingDensity]
        features.append([temp, ndvi, bld_density])
        
        # Generate Synthetic Ground Truth for "Vulnerability"
        # Formula: High Temp (+), High Density (+), High Vegetation (-)
        # We assume Temp is roughly 25-50C, NDVI 0-1, Density 0-1
        
        # Normalize Temp roughly to 0-1 range for the formula (assuming 20C min, 50C max)
        norm_temp = (temp - 20) / 30
        
        # Weights: Temperature is dominant (0.6), Density aggravates (0.3), Greenery mitigates (0.3)
        risk_score = (norm_temp * 0.6) + (bld_density * 0.3) - (ndvi * 0.3)
        
        # Add some random noise to simulate real-world data "messiness" so the model doesn't just learn the formula perfectly
        # This makes the "AI" aspect real - it's learning a pattern, not a hardcoded function
        noise = np.random.normal(0, 0.05) 
        final_risk = np.clip(risk_score + noise, 0, 1)
        
        targets.append(final_risk)
        
    X = np.array(features)
    y = np.array(targets)
    
    print(f"Training on {len(X)} data points...")
    
    # Split Data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Initialize Random Forest
    rf = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
    
    # Train
    rf.fit(X_train, y_train)
    
    # Evaluate
    y_pred = rf.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print("-" * 30)
    print(f"Model Training Complete")
    print(f"Mean Squared Error: {mse:.4f}")
    print(f"R2 Score (Accuracy): {r2:.4f}")
    print("-" * 30)
    
    # Save Model
    joblib.dump(rf, MODEL_FILE)
    print(f"Model saved to {MODEL_FILE}")

if __name__ == "__main__":
    train_model()
