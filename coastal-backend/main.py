from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from shapely.geometry import Polygon
import geopandas as gpd
import os
import shutil
from fastapi.staticfiles import StaticFiles
import ee

try:
    ee.Initialize(project="ee-yallajaswanth2")
    print("Earth Engine initialized")
except Exception:
    ee.Authenticate()
    ee.Initialize(project="ee-yallajaswanth2")

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware
from services import ( 
    satellite_images_extraction,
    image_cleaning,
    shoreline_extractions,
    transect_baseline_generation,
    hyperparameter_tuning,
    poly_prediction,
    erosion_accretion_calculator
)

# Mount the folder with your images
app.mount("/static", StaticFiles(directory="data/cleaned_output"), name="static")

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # frontend origin
    allow_credentials=True,
    allow_methods=["*"],    # allow POST, GET, OPTIONS, etc
    allow_headers=["*"],    # allow any headers
)

class AOIRequest(BaseModel):
    coordinates: list  # list of polygons, each polygon is list of [lon, lat] pairs
def coords_to_polygon(coords):
    """
    Convert OpenLayers-style coordinates [[[lon, lat], ...]] 
    to a Shapely Polygon.
    """
    # unwrap extra outer array if needed
    if isinstance(coords[0][0], list):
        coords = coords[0]
    # convert each point to tuple
    coords_tuples = [tuple(pt) for pt in coords]
    return Polygon(coords_tuples)

@app.post("/extract-images/")
async def extract_images(aoi: AOIRequest):
    try:
        polygons = []
        print(aoi.coordinates,end="\n")
        print("\n")
        # Convert all polygons to Shapely Polygons
        for poly_coords in aoi.coordinates:
            print(poly_coords,end="\n")
            print("\n")
            polygon = coords_to_polygon(poly_coords)
            polygons.append(polygon)
        print(polygons)
        # Create GeoDataFrame in EPSG:4326
        gdf = gpd.GeoDataFrame({'geometry': polygons}, crs="EPSG:4326")

        # Project to UTM to compute area in m²
        gdf_utm = gdf.to_crs(epsg=32644)  # choose correct UTM zone for your region
        total_area_m2 = gdf_utm['geometry'].area.sum()
        print(f"Total AOI area (m²): {total_area_m2}")

        # Initialize Earth Engine
        ee.Initialize(project="ee-jaswanthyalla123")
        print("earth engine intialized")
        ee_polygons = []
        for i, poly_coords in enumerate(aoi.coordinates):
            # Close polygon if not already closed
            if poly_coords[0] != poly_coords[-1]:
                poly_coords.append(poly_coords[0])
            try:
                ee_poly = ee.Geometry.Polygon(poly_coords)
                ee_polygons.append(ee_poly)
            except Exception as e:
                print(f"Failed to create EE polygon {i}: {e}")
        print(ee_polygons)

        result=satellite_images_extraction.process_ndwi_for_aoi(ee_polygons,output_folder="data/output")
        print(result)
        return {"message": "NDWI extraction completed", "results": result}
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Shoreline Data Endpoint
# -----------------------------
@app.get("/shoreline-data/")
def get_shoreline_data():
    import json
    try:
        from pyproj import Transformer
        path = "data/shorelines_data/predicted_shoreline_points_2025.geojson"
        with open(path) as f:
            gj = json.load(f)

        # Convert from UTM EPSG:32644 to WGS84 EPSG:4326
        transformer = Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)
        for feature in gj["features"]:
            coords = feature["geometry"]["coordinates"]
            lon, lat = transformer.transform(coords[0], coords[1])
            feature["geometry"]["coordinates"] = [lon, lat]

        gj["crs"] = {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}}
        return JSONResponse(gj)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    

 
@app.get("/api/dashboard-data/")
def get_dashboard_data():
    results_summary = [
    {'year': 2016, 'ndwi_file': 'data/output//NDWI_2016.tif', 'download_status': 'success', 'water_percentage': 56.07227943807111}, 
    {'year': 2017, 'ndwi_file': 'data/output//NDWI_2017.tif', 'download_status': 'success', 'water_percentage': 54.90235344782577}, 
    {'year': 2018, 'ndwi_file': 'data/output//NDWI_2018.tif', 'download_status': 'success', 'water_percentage': 54.75991243995314}, 
    {'year': 2019, 'ndwi_file': 'data/output//NDWI_2019.tif', 'download_status': 'success', 'water_percentage': 54.8587801653437}, 
    {'year': 2020, 'ndwi_file': 'data/output//NDWI_2020.tif', 'download_status': 'success', 'water_percentage': 55.55469121487637}, 
    {'year': 2021, 'ndwi_file': 'data/output//NDWI_2021.tif', 'download_status': 'success', 'water_percentage': 56.277758914126466}, 
    {'year': 2022, 'ndwi_file': 'data/output//NDWI_2022.tif', 'download_status': 'success', 'water_percentage': 56.36416962148536}, 
    {'year': 2023, 'ndwi_file': 'data/output//NDWI_2023.tif', 'download_status': 'success', 'water_percentage': 54.85636234749789}, 
    {'year': 2024, 'ndwi_file': 'data/output//NDWI_2024.tif', 'download_status': 'success', 'water_percentage': 50.38080631071482}, 
    {'year': 2025, 'ndwi_file': 'data/output//NDWI_2025.tif', 'download_status': 'success', 'water_percentage': 56.456519750943734}
    ]

    years = [r["year"] for r in results_summary]
    water_percent = [r["water_percentage"] for r in results_summary]
    land_percent = [100 - r["water_percentage"] for r in results_summary]

    summary = {
        "years": years,
        "water_percent": water_percent,
        "land_percent": land_percent,
        "mean_ndwi": [round(w / 100, 2) for w in water_percent],  # dummy NDWI values
        "aoi_km2": 12.34,
        "aoi_m2": 12340000,
        "num_images": len(results_summary),
        "start_year": years[0],
        "end_year": years[-1],
    }

    images = [
        {"year": r["year"], "thumbnail_url": f"/static/plot_NDWI_{r['year']}.png"}
        for r in results_summary
    ]

    logs = [f"Processed year {r['year']} with {r['water_percentage']:.2f}% water" for r in results_summary]

    return JSONResponse({"summary": summary, "images": images, "logs": logs})

# -----------------------------
# 2️⃣ Image Cleaning
# -----------------------------

@app.post("/clean-images/")
async def clean_images(
    input_folder: str = "data/output",          # folder where NDWI tifs are saved
    output_folder: str = "data/cleaned_output" # folder for cleaned images
):
    os.makedirs(input_folder, exist_ok=True)
    os.makedirs(output_folder, exist_ok=True)

    # Run your cleaning function on all TIFFs in the input folder
    results = image_cleaning.clean_and_crop_ndwi_folder(input_folder, output_folder)

    return {
        "status": "success",
        "processed_files": [os.path.basename(r[0]) for r in results if r],
    }

# -----------------------------
# 3️⃣ Shoreline Extraction
# -----------------------------
@app.post("/extract-shorelines/")
async def extract_shorelines():
    try:
        folder = "data/cleaned_output"
        gdf = shoreline_extractions.extract_shorelines_from_folder(folder)
        if gdf is not None:
            shoreline_extractions.save_shorelines_gdf(gdf, "shorelines.geojson")
            shoreline_extractions.split_shorelines_by_year("shorelines.geojson", "data/shorelines_data")
            return {"message": "Shorelines extracted and split into years", "details": {"count": len(gdf)}}
        return {"message": "No shorelines found in images"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# 4️⃣ Transect & Baseline Generation
# -----------------------------
@app.post("/generate-transects/")
async def generate_transects():
    try:
        import geopandas as gpd
        gdf = gpd.read_file("shorelines.geojson")
        result = transect_baseline_generation.process_shorelines_transects(gdf)
        return {"message": "Transects generated and shoreline distances extracted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# 5️⃣ Hyperparameter Tuning
# -----------------------------
@app.post("/tune-hyperparameters/")
async def tune_hyperparameters():
    try:
        result = hyperparameter_tuning.tune_polynomial_regression()
        return {"message": "Hyperparameters tuned", "details": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# 6️⃣ Polynomial Regression Prediction
# -----------------------------
@app.post("/predict-shoreline/")
async def predict_shoreline(future_year: int):
    try:
        result = poly_prediction.predict_shoreline(future_year=future_year)
        # Save the result to the file that /shoreline-data/ expects
        import json
        with open(f"data/shorelines_data/predicted_shoreline_points_{future_year}.geojson", "w") as f:
            json.dump(result["predicted_points"], f)
            
        return {"message": f"Shoreline predicted for {future_year}", "details": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# 7️⃣ Erosion & Accretion Calculation
# -----------------------------
@app.post("/calculate-erosion/")
async def calculate_erosion():
    try:
        result = erosion_accretion_calculator.calculate_erosion_accretion()
        return {"message": "Erosion/Accretion calculated", "stats": result["stats"], "results": result["results"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
async def root():
    return {"message": "Welcome to Coastal Erosion Prediction API"}
