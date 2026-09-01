# Coastal Erosion 

A state-of-the-art, full-stack AI application designed to dynamically extract, analyze, and predict coastal shoreline erosion using high-resolution satellite imagery from Google Earth Engine.

## 🌊 Overview

The Coastal Erosion AI Predictor empowers researchers and scientists to instantly analyze historical shoreline changes and mathematically predict future coastline erosion or accretion rates. 

The application utilizes a powerful 6-step AI pipeline:
1. **Extract NDWI**: Connects to Google Earth Engine via API, downloads 10 years of Sentinel-2 satellite imagery for the selected area, and computes the Normalized Difference Water Index (NDWI) to isolate water from land.
2. **Clean Images**: Applies Gaussian and Median smoothing algorithms to remove atmospheric noise and coastal artifacting from the satellite data.
3. **Extract Shorelines**: Uses Otsu's Thresholding and the Marching Squares algorithm to mathematically trace the exact boundary between land and water, generating highly precise GeoJSON shoreline vectors.
4. **Generate Transects**: Dynamically generates perpendicular baseline transects (every 50 meters) along the entire stretch of the coast.
5. **AI Prediction**: Utilizes Polynomial Regression trained on 10 years of historical shoreline shift data to predict exactly where the coastline will be in any future year.
6. **Erosion Stats**: Calculates the absolute distance between the historical baseline and the AI prediction to provide detailed metrics (Average Erosion Rate, Eroded Area %, Accreted Area %) and visually overlays the damage directly onto the map.

## 🛠️ Tech Stack

**Frontend (React/Vite)**
- React.js + Vite
- Tailwind CSS (Premium Glassmorphism & 3D Interactive UI)
- OpenLayers (`ol`) for high-performance interactive satellite mapping
- React Router

**Backend (Python/FastAPI)**
- FastAPI (High-performance Async API)
- Google Earth Engine (`ee`, `geemap`)
- GeoPandas, Shapely (Geospatial Geometry Engine)
- Scikit-Learn (Polynomial Regression AI)
- Rasterio, Scikit-Image (Image Processing)

## Quick Start

### 1. Start the Python Backend
Ensure you have authenticated with Google Earth Engine (`earthengine authenticate`) and installed the required `pip` packages.
```bash
cd coastal-backend
uvicorn main:app --reload
```

### 2. Start the React Frontend
Ensure you have installed the npm modules (`npm install`).
```bash
cd Front-End
npm run dev
```

Open `http://localhost:5173` in your browser.

##  UI / UX Features

- **Interactive Satellite Bounding**: Draw dynamic 2:1 aspect-ratio rectangles directly onto the map to select your Region of Interest (ROI). Auto-clamps to safe 30km sizes to prevent API overload.
- **Glassmorphic Dashboard**: Features frosted-glass overlays, true 3D interactive buttons, glowing gradients, and custom scrollbars.
- **Real-time Terminal**: Watch the backend Python pipeline process your data in real-time directly through the frontend UI terminal.
- **Visual Erosion Analytics**: Instantly see Accretion (Solid Green Lines) and Erosion (Dotted Red Lines) painted directly over the satellite imagery.