import sys
import os

# Add the project root to Python path so `server/` is importable on Vercel
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
# Also add server/ itself so bare imports (from azure_services, from config) resolve
sys.path.insert(0, os.path.join(project_root, "server"))

from server.main import app
