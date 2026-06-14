# shorelines.py
import os
import glob
import numpy as np
import rasterio
from rasterio import transform
from scipy.ndimage import median_filter
from skimage import filters, measure
import geopandas as gpd
from shapely.geometry import LineString
import matplotlib.pyplot as plt
from matplotlib import cm

# -----------------------------
# Function: Extract shorelines from NDWI TIFFs
# -----------------------------
def extract_shorelines_from_folder(folder_path):
    """
    Extracts shorelines from all NDWI GeoTIFFs in a folder.
    Returns a GeoDataFrame with 'year', 'month', 'geometry'.
    """
    tif_files = sorted(glob.glob(os.path.join(folder_path, "*.tif")))
    shorelines = []
    last_crs = None

    for tif_file in tif_files:
        fname = os.path.basename(tif_file).replace(".tif", "")
        parts = fname.split("_")
        year = int(parts[1])
        month = int(parts[2]) if len(parts) > 2 else None

        try:
            with rasterio.open(tif_file) as src:
                ndwi = src.read(1).astype(float)
                transform = src.transform
                last_crs = src.crs
        except Exception:
            continue

        # Smooth
        ndwi_smooth = median_filter(ndwi, size=3)

        # Threshold
        valid_pixels = ndwi_smooth[~np.isnan(ndwi_smooth)]
        th = filters.threshold_otsu(valid_pixels) if len(valid_pixels) > 0 else 0
        water_mask = ndwi_smooth > th

        # Contours
        contours = measure.find_contours(water_mask.astype(float), 0.5)
        for contour in contours:
            coords = [rasterio.transform.xy(transform, int(r), int(c)) for r, c in contour]
            if len(coords) > 5:
                shorelines.append({
                    "year": year,
                    "month": month,
                    "geometry": LineString(coords)
                })

    if shorelines:
        raster_crs = last_crs.to_string() if last_crs else "EPSG:4326"
        gdf = gpd.GeoDataFrame(shorelines, geometry="geometry", crs=raster_crs)
        # Optionally project to UTM
        gdf = gdf.to_crs(epsg=32644)
        return gdf
    else:
        return None


# -----------------------------
# Function: Save GeoJSON
# -----------------------------
def save_shorelines_gdf(gdf, output_file="shorelines.geojson"):
    """
    Save GeoDataFrame to GeoJSON.
    """
    gdf.to_file(output_file, driver="GeoJSON")
    return output_file


# -----------------------------
# Function: Split shorelines by year
# -----------------------------
def split_shorelines_by_year(input_file, output_folder="shorelines_data"):
    """
    Splits a shoreline GeoJSON by year into separate files.
    """
    gdf = gpd.read_file(input_file)
    os.makedirs(output_folder, exist_ok=True)
    out_files = []

    for year in sorted(gdf['year'].unique()):
        yearly = gdf[gdf['year'] == year]
        out_file = os.path.join(output_folder, f"shoreline_{year}.geojson")
        yearly.to_file(out_file, driver="GeoJSON")
        out_files.append(out_file)

    return out_files


# -----------------------------
# Example usage
# -----------------------------
if __name__ == "__main__":
    folder = "cleaned_output"
    gdf = extract_shorelines_from_folder(folder)
    if gdf is not None:
        save_shorelines_gdf(gdf, "shorelines.geojson")
        split_shorelines_by_year("shorelines.geojson", "shorelines_data")