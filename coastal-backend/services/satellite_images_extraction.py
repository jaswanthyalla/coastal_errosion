import ee
import os
import requests
import numpy as np
from skimage.filters import threshold_otsu
from scipy.ndimage import median_filter

# -----------------------------
# Initialize Earth Engine
# -----------------------------
def init_ee(project="ee-yallajaswanth2"):
    try:
        ee.Initialize(project=project)
    except ee.EEException:
        ee.Authenticate()
        ee.Initialize(project=project)

# -----------------------------
# Smooth contour helper
# -----------------------------
from skimage import measure

def smooth_contour(contour, window=5):
    smoothed = contour.copy()
    for i in range(2):
        smoothed[:, i] = np.convolve(contour[:, i], np.ones(window)/window, mode='same')
    return smoothed

# -----------------------------
# Process NDWI for a list of EE polygons with download tracking and water %
# -----------------------------
def process_ndwi_for_aoi(ee_polygons, output_folder="data/output"):
    init_ee()
    os.makedirs(output_folder, exist_ok=True)

    # Support single polygon or list of polygons
    if isinstance(ee_polygons, list):
        AOI = ee.FeatureCollection([ee.Feature(poly) for poly in ee_polygons])
    else:
        AOI = ee.FeatureCollection([ee.Feature(ee_polygons)])

    results_summary = []
    
    import datetime
    import concurrent.futures
    current_year = datetime.datetime.now().year

    def process_year(year):
        dataset = "COPERNICUS/S2" if year <= 2018 else "COPERNICUS/S2_SR_HARMONIZED"
        start = ee.Date.fromYMD(year - 1, 11, 1)
        end = ee.Date.fromYMD(year, 2, 28)

        collection = (ee.ImageCollection(dataset)
                      .filterBounds(AOI)
                      .filterDate(start, end)
                      .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 5))
                      .sort("system:time_start"))
        collection = collection.select(["B3","B8","B4"])
        print(f"\n--- Processing year {year} ---")
        size = collection.size().getInfo()
        if size == 0:
            composite = ee.Image.constant([0, 0, 0, 0]).rename(["B3","B4","B8","B8A"]).clip(AOI)
        else:
            composite = collection.median()
            for b in ["B3","B4","B8"]:
                if not composite.bandNames().contains(b).getInfo():
                    composite = composite.addBands(ee.Image.constant(0).rename(b))

        # Compute NDWI and NDVI
        ndwi = composite.normalizedDifference(["B3","B8"]).rename("NDWI")
        ndvi = composite.normalizedDifference(["B8","B4"]).rename("NDVI")
        water_masked = ndwi.updateMask(ndvi.lt(0.1))

        # Compute water percentage
        try:
            # Export to array
            url = water_masked.getDownloadURL({
                'scale': 10,
                'region': AOI.geometry(),
                'format': 'GeoTIFF'
            })
            with requests.get(url, stream=True) as r:
                r.raise_for_status()
                local_path = os.path.join(output_folder, f"NDWI_{year}.tif")
                with open(local_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)

            # Compute water percentage from saved GeoTIFF
            import rasterio
            with rasterio.open(local_path) as src:
                ndwi_data = src.read(1)
            ndwi_smooth = median_filter(ndwi_data, size=3)
            valid_pixels = ndwi_smooth[~np.isnan(ndwi_smooth)]
            if valid_pixels.size > 0:
                th = threshold_otsu(valid_pixels)
            else:
                th = 0
            water_mask = ndwi_smooth > th
            water_percentage = float(np.sum(water_mask) / water_mask.size * 100)
            download_status = "success"

            # 🟢 GENERATE PREVIEW PNG FOR STEP 1
            import matplotlib.pyplot as plt
            static_folder = "data/cleaned_output"
            os.makedirs(static_folder, exist_ok=True)
            plt.figure(figsize=(6, 4))
            plt.imshow(ndwi_smooth, cmap='Blues', vmin=-1, vmax=1)
            plt.title(f"Raw NDWI {year}")
            plt.axis('off')
            plt.savefig(os.path.join(static_folder, f"plot_NDWI_{year}.png"), bbox_inches='tight', dpi=100)
            plt.close()

            print(f"[SUCCESS] Year {year}: Downloaded successfully. Water: {water_percentage:.2f}%")
        except Exception as e:
            local_path = None
            water_percentage = None
            download_status = f"failed: {str(e)}"
            print(f"[ERROR] Year {year}: Failed - {str(e)[:100]}")
            
        return {
            "year": year,
            "ndwi_file": local_path,
            "download_status": download_status,
            "water_percentage": water_percentage
        }

    # Parallelize downloading
    years_to_process = list(range(2016, current_year + 1))
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(process_year, years_to_process))
        
    # Sort results to maintain chronological order
    results.sort(key=lambda x: x["year"])
    results_summary.extend(results)

    return results_summary
