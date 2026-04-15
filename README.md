# HeatShield.ai

![HeatShield.ai Banner](HotSpots-AI/public/HeatShieldai.png)

**HeatShield.ai** is an advanced urban climate monitoring platform that leverages satellite data and 3D visualization to identify heat vulnerability hotspots.

## Features
-   **Real-time Visualization:** Interactive 3D maps of heat vulnerability.
-   **AI-Powered Analysis:** Machine learning models trained on real Sentinel/Landsat data.
-   **City-Scale:** Currently live in **New Delhi, India**.

![Visualization Demo](HotSpots-AI/public/hotspots.png)

## Tech Stack
-   **Frontend:** Next.js 16, Deck.gl, Mapbox
-   **Backend:** Python (FastAPI), Serverless Functions
-   **Deployment:** Vercel

## Getting Started

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/deepanjan1011/hotspots.git
    cd hotspots
    ```

2.  **Run Frontend** (from `HotSpots-AI`):
    ```bash
    cd HotSpots-AI
    npm install
    npm run dev
    ```

3.  **Run Backend** — use **one** Python environment under `HotSpots-AI/server` (ignore any other `venv` folders elsewhere):

    **First-time setup** (creates `HotSpots-AI/server/.venv` and installs deps):
    ```bash
    cd HotSpots-AI/server
    python3 -m venv .venv
    source .venv/bin/activate   # Windows: .venv\Scripts\activate
    # Fish shell: source .venv/bin/activate.fish
    python -m pip install -r requirements.txt
    ```

    **Start the API** — either:
    ```bash
    cd HotSpots-AI/server
    source .venv/bin/activate   # Fish: source .venv/bin/activate.fish
    python -m uvicorn main:app --reload --port 8000
    ```
    or from `HotSpots-AI` after the venv exists and dependencies are installed:
    ```bash
    npm run backend
    ```

    The script `server/run-dev.sh` uses `server/.venv` if present, else `server/venv`, else `python3`.

    **Note:** `HotSpots-AI/requirements.txt` is a slim set for Vercel. For local backend development, use **`HotSpots-AI/server/requirements.txt`** (as above).

Visit `http://localhost:3000` to see the application.
