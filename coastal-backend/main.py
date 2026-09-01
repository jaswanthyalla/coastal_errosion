from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from shapely.geometry import Polygon
import geopandas as gpd
import os
import shutil
from fastapi.staticfiles import StaticFiles
import ee
import os
import json

# Setup Earth Engine Credentials on Render
EE_CREDS = os.environ.get("EE_CREDENTIALS")
if EE_CREDS:
    creds_dir = os.path.expanduser("~/.config/earthengine")
    os.makedirs(creds_dir, exist_ok=True)
    with open(os.path.join(creds_dir, "credentials"), "w") as f:
        f.write(EE_CREDS)
    print("Earth Engine credentials successfully loaded from Render Environment.")

try:
    ee.Initialize(project="ee-yallajaswanth2")
    print("Earth Engine initialized")
except Exception as e:
    print(f"Warning: Earth Engine failed to initialize on startup: {e}")
    print("You may need to check your network connection or run `ee.Authenticate()` manually.")

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

def update_run_metadata(new_data):
    import json, os
    os.makedirs("data", exist_ok=True)
    path = "data/run_metadata.json"
    data = {}
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                data = json.load(f)
        except Exception:
            pass
    data.update(new_data)
    with open(path, "w") as f:
        json.dump(data, f)

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
        total_area_m2 = float(gdf_utm['geometry'].area.sum())
        print(f"Total AOI area (m²): {total_area_m2}")
        
        update_run_metadata({
            "coordinates": aoi.coordinates,
            "aoi_m2": total_area_m2,
            "aoi_km2": total_area_m2 / 1_000_000
        })

        # Initialize Earth Engine
        ee.Initialize(project="ee-yallajaswanth2")
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
    import os
    try:
        from pyproj import Transformer
        
        # Determine the latest prediction year
        prediction_year = 2025
        metadata_path = "data/run_metadata.json"
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                    prediction_year = metadata.get("prediction_year", 2025)
            except Exception:
                pass
                
        path = f"data/shorelines_data/predicted_shoreline_points_{prediction_year}.geojson"
        
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Shoreline data not found for the requested year.")

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
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/extracted-shorelines/")
def get_extracted_shorelines():
    import json
    import os
    try:
        from pyproj import Transformer
        path = "shorelines.geojson"
        
        if not os.path.exists(path):
            return JSONResponse({"type": "FeatureCollection", "features": []})
            
        with open(path) as f:
            gj = json.load(f)

        # Convert from UTM EPSG:32644 to WGS84 EPSG:4326
        transformer = Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)
        for feature in gj["features"]:
            if feature["geometry"]["type"] == "LineString":
                new_coords = []
                for coords in feature["geometry"]["coordinates"]:
                    lon, lat = transformer.transform(coords[0], coords[1])
                    new_coords.append([lon, lat])
                feature["geometry"]["coordinates"] = new_coords
            elif feature["geometry"]["type"] == "MultiLineString":
                new_multi = []
                for linestring in feature["geometry"]["coordinates"]:
                    new_coords = []
                    for coords in linestring:
                        lon, lat = transformer.transform(coords[0], coords[1])
                        new_coords.append([lon, lat])
                    new_multi.append(new_coords)
                feature["geometry"]["coordinates"] = new_multi

        gj["crs"] = {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}}
        return JSONResponse(gj)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/erosion-geojson/")
def get_erosion_geojson():
    import json
    import os
    try:
        path = "data/erosion_results.geojson"
        if os.path.exists(path):
            with open(path, "r") as f:
                gj = json.load(f)
            return JSONResponse(gj)
        return JSONResponse({"type": "FeatureCollection", "features": []})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

 
@app.get("/transects/")
def get_transects():
    import json
    import os
    try:
        from pyproj import Transformer
        path = "transects.geojson"
        if not os.path.exists(path):
            return JSONResponse({"type": "FeatureCollection", "features": []})
        with open(path) as f:
            gj = json.load(f)

        # Convert from UTM EPSG:32644 to WGS84 EPSG:4326
        transformer = Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)
        for feature in gj["features"]:
            if feature["geometry"]["type"] == "LineString":
                new_coords = []
                for coords in feature["geometry"]["coordinates"]:
                    lon, lat = transformer.transform(coords[0], coords[1])
                    new_coords.append([lon, lat])
                feature["geometry"]["coordinates"] = new_coords

        gj["crs"] = {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}}
        return JSONResponse(gj)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dashboard-data/")
def get_dashboard_data():
    import json, os
    path = "data/run_metadata.json"
    metadata = {}
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                metadata = json.load(f)
        except Exception:
            pass

    results_summary = metadata.get("image_stats", [])
    # Sort by year just in case
    results_summary = sorted(results_summary, key=lambda x: x["year"])

    # If no data is available yet, provide a single dummy entry so charts don't break completely
    if not results_summary:
        results_summary = [
            {'year': 2020, 'cleaned_path': 'data/cleaned_output/NDWI_2020.tif', 'water_percentage': 50.0}
        ]

    years = [r["year"] for r in results_summary]
    water_percent = [r["water_percentage"] for r in results_summary]
    land_percent = [100 - r["water_percentage"] for r in results_summary]

    summary = {
        "years": years,
        "water_percent": water_percent,
        "land_percent": land_percent,
        "mean_ndwi": [round((w/100)*0.6, 2) for w in water_percent],  # dummy NDWI scaling using water%
        "aoi_km2": metadata.get("aoi_km2", 12.34),
        "aoi_m2": metadata.get("aoi_m2", 12340000),
        "coordinates": metadata.get("coordinates", []),
        "erosion_stats": metadata.get("erosion_stats", None),
        "prediction_year": metadata.get("prediction_year", 2025),
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
    
    # Strip non-serializable objects (like good_contours) before saving to metadata
    image_stats = []
    for r in results:
        if r:
            image_stats.append({
                "year": r["year"],
                "cleaned_path": r["cleaned_path"],
                "water_percentage": r["water_percentage"]
            })
            
    update_run_metadata({
        "image_stats": image_stats
    })

    return {
        "status": "success",
        "processed_files": [os.path.basename(r["cleaned_path"]) for r in results if r],
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
        import os
        import geopandas as gpd
        if not os.path.exists("shorelines.geojson"):
            return {"message": "No shorelines exist to generate transects. Please draw an area with a visible coastline."}
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
        
        update_run_metadata({
            "prediction_year": future_year
        })
            
        return {"message": f"Shoreline predicted for {future_year}", "details": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# 7️⃣ Erosion & Accretion Calculation
# -----------------------------
@app.post("/calculate-erosion/")
async def calculate_erosion(future_year: int = 2025):
    try:
        import os
        shoreline_future_file = f"data/shorelines_data/predicted_shoreline_points_{future_year}.geojson"
        
        result = erosion_accretion_calculator.calculate_erosion_accretion(
            shoreline_future_file=shoreline_future_file,
            future_year=future_year
        )
        update_run_metadata({
            "erosion_stats": result["stats"],
            "prediction_year": future_year
        })
        return {"message": "Erosion/Accretion calculated", "stats": result["stats"], "results": result["results"], "geojson": result.get("geojson")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# Root Endpoint
# -----------------------------
@app.get("/")
async def root():
    return {"message": "Welcome to Coastal Erosion Prediction API"}
