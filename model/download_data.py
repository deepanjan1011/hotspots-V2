import ee
import geemap
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.config import BBOX, CITY_NAME

def authenticate_and_initialize():
    try:
        ee.Initialize()
        print("Earth Engine initialized successfully.")
    except Exception as e:
        print(f"Initialization failed: {e}")
        print("Authenticating...")
        try:
            ee.Authenticate()
            ee.Initialize()
        except Exception as e2:
            print(f"Authentication/Initialization failed: {e2}")
            print("\nIf you are seeing a 'no project' error, you need to provide your Google Cloud Project ID.")
            project_id = input("Please enter your Google Cloud Project ID: ").strip()
            if project_id:
                ee.Initialize(project=project_id)
                print(f"Successfully initialized with project: {project_id}")
            else:
                raise e2

def download_satellite_data(output_dir="server/data"):
    # Define ROI from config BBOX (min_lon, min_lat, max_lon, max_lat)
    roi = ee.Geometry.Rectangle([BBOX[0], BBOX[1], BBOX[2], BBOX[3]])

    # Date range for summer (to capture heat)
    start_date = '2023-06-01'
    end_date = '2023-09-01'

    print(f"Downloading data for {CITY_NAME}...")
    
    # 1. LAND SURFACE TEMPERATURE (LST) from Landsat 8
    print("Fetching Land Surface Temperature (LST)...")
    landsat = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")\
        .filterBounds(roi)\
        .filterDate(start_date, end_date)\
        .filter(ee.Filter.lt('CLOUD_COVER', 10))\
        .median()\
        .clip(roi)
    
    # Thermal band (ST_B10) - Convert Kelvin to Celsius
    # Scale factor 0.00341802 + 149.0
    lst_kelvin = landsat.select('ST_B10').multiply(0.00341802).add(149.0)
    lst_celsius = lst_kelvin.subtract(273.15).rename('LST')

    # 2. NDVI
    print("Fetching NDVI...")
    ndvi = landsat.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI')

    # Export
    os.makedirs(output_dir, exist_ok=True)
    
    lst_out = os.path.join(output_dir, f"{CITY_NAME.lower()}_lst.tif")
    ndvi_out = os.path.join(output_dir, f"{CITY_NAME.lower()}_ndvi.tif")

    print(f"Exporting LST to {lst_out}...")
    geemap.ee_export_image(lst_celsius, filename=lst_out, scale=30, region=roi, file_per_band=False)

    print(f"Exporting NDVI to {ndvi_out}...")
    geemap.ee_export_image(ndvi, filename=ndvi_out, scale=30, region=roi, file_per_band=False)
    
    print("Download complete.")
    
    return lst_out, ndvi_out

if __name__ == "__main__":
    authenticate_and_initialize()
    download_satellite_data()
