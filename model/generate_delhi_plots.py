
import matplotlib.pyplot as plt
import numpy as np
import os
import rasterio
import geopandas as gpd
from rasterio.plot import show

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "server/data")
OUTPUT_DIR = os.path.join(BASE_DIR, "HotSpots-AI/public")

LST_PATH = os.path.join(DATA_DIR, "new delhi_lst.tif")
NDVI_PATH = os.path.join(DATA_DIR, "new delhi_ndvi.tif")
BUILDINGS_PATH = os.path.join(DATA_DIR, "new delhi_buildings.shp")

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def plot_raster(tif_path, title, cmap, filename):
    try:
        with rasterio.open(tif_path) as src:
            fig, ax = plt.subplots(figsize=(6, 5))
            
            # Read first band
            data = src.read(1)
            
            # Simple normalization/clip for better visualization if needed
            # For NDVI: -1 to 1. 
            # For LST: 20 to 50 Celsius usually. 
            # We trust the data is decent from our previous checks.
            
            if "NDVI" in title:
                vmin, vmax = -0.2, 0.8
            else:
                vmin, vmax = None, None

            # Extent
            extent = [src.bounds.left, src.bounds.right, src.bounds.bottom, src.bounds.top]
            
            im = ax.imshow(data, cmap=cmap, origin='upper', extent=extent, vmin=vmin, vmax=vmax)
            
            # Formatting
            plt.colorbar(im, ax=ax)
            ax.set_title(title)
            ax.axis('off') # Cleaner look for UI
            
            save_path = os.path.join(OUTPUT_DIR, filename)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"Saved {filename}")
            plt.close(fig)
            
    except Exception as e:
        print(f"Error plotting raster {filename}: {e}")

def plot_buildings(shp_path, title, cmap, filename):
    try:
        gdf = gpd.read_file(shp_path)
        
        fig, ax = plt.subplots(figsize=(6, 5))
        
        # Plot density as a 2D Histogram of centroids
        # This looks like a heatmap/grid which is nicer than raw polygons for "Density" view
        centroids = gdf.geometry.centroid
        x = centroids.x
        y = centroids.y
        
        # Create heatmap
        # bins determines resolution
        plt.hist2d(x, y, bins=50, cmap=cmap)
        
        plt.colorbar(label='Building Count')
        ax.set_title(title)
        ax.axis('off')
        
        save_path = os.path.join(OUTPUT_DIR, filename)
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Saved {filename}")
        plt.close(fig)
        
    except Exception as e:
        print(f"Error plotting buildings {filename}: {e}")

if __name__ == "__main__":
    print("Generating Real Data Plots...")
    
    # Tree Density -> Use NDVI
    plot_raster(NDVI_PATH, "Tree Density (NDVI)", "Greens", "TreeDensity.png")
    
    # Building Density -> Use Building Centroids Heatmap
    plot_buildings(BUILDINGS_PATH, "Building Density", "OrRd", "BuildingDensity.png")
    
    print("Done!")
