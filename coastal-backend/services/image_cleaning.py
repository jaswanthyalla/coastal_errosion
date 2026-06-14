import os
import shutil
import numpy as np
import rasterio
from rasterio.windows import Window
from skimage.filters import threshold_otsu
from scipy.ndimage import median_filter, binary_opening, binary_closing, generate_binary_structure, label
from skimage import measure
from shapely.geometry import Polygon
import matplotlib.pyplot as plt

def clean_and_crop_ndwi_folder(
    input_folder,
    output_folder="cleaned_output",
    save_png=True,
    smooth_size=2,
    morph_size=2,
    min_region_pixels=1000,
    min_contour_length=50,
    keep_largest_water=True,
    border_pixels=1,
    edge_frac_thresh=0.01,
    buffer_pixels=0
):
    """
    Complete NDWI processing pipeline:
    1️⃣ Clean each NDWI TIFF in folder
    2️⃣ Extract water contours
    3️⃣ Save cleaned TIFF and optional PNG
    4️⃣ Auto-crop black borders
    """

    os.makedirs(output_folder, exist_ok=True)
    struct = generate_binary_structure(2, 2)
    results = []

    # -----------------------------
    # Helper: Clean water mask
    # -----------------------------
    def clean_water_mask(water_mask):
        opened = binary_opening(water_mask, structure=struct, iterations=morph_size)
        closed = binary_closing(opened, structure=struct, iterations=morph_size)
        labeled, ncomp = label(closed)
        clean = np.zeros_like(closed, dtype=bool)
        if ncomp == 0:
            return clean
        for region_id in range(1, ncomp + 1):
            mask_region = (labeled == region_id)
            if mask_region.sum() >= min_region_pixels:
                clean |= mask_region
        if keep_largest_water:
            labeled2, n2 = label(clean)
            if n2 > 0:
                sizes = [(rid, (labeled2 == rid).sum()) for rid in range(1, n2 + 1)]
                rid_max = max(sizes, key=lambda x: x[1])[0]
                clean = (labeled2 == rid_max)
        return clean
    
    # -----------------------------
    # Helper: Filter contours
    # -----------------------------
    def filter_contours_by_length(contours):
        return [c for c in contours if len(c) >= min_contour_length]
 
    # -----------------------------
    # Helper: Process a single TIFF
    # -----------------------------
    def process_ndwi_file(file_path):
        try:
            with rasterio.open(file_path) as src:
                ndwi = src.read(1)
                profile = src.profile
        except rasterio.errors.RasterioIOError:
            return None

        # Smooth
        ndwi_smooth = median_filter(ndwi, size=smooth_size)

        # Threshold
        valid = ndwi_smooth[~np.isnan(ndwi_smooth)]
        th = threshold_otsu(valid) if valid.size > 0 else 0
        water_mask = ndwi_smooth > th

        # Remove border artifacts
        water_mask[:border_pixels, :] = 0
        water_mask[-border_pixels:, :] = 0
        water_mask[:, :border_pixels] = 0
        water_mask[:, -border_pixels:] = 0

        # Clean mask
        water_mask_clean = clean_water_mask(water_mask)

        # Extract contours
        contours = measure.find_contours(water_mask_clean, 0.5)
        contours = filter_contours_by_length(contours)
        good_contours = []
        for c in contours:
            coords = [(pt[1], pt[0]) for pt in c]
            try:
                poly = Polygon(coords)
                if not poly.is_valid:
                    poly = poly.buffer(0)
                if poly.area > 1.0:
                    good_contours.append(c)
            except Exception:
                continue

        # Save cleaned TIFF
        optimized = (water_mask_clean.astype(np.uint8) * 255)
        profile.update(dtype=rasterio.uint8, count=1, compress='lzw')
        cleaned_path = os.path.join(output_folder, os.path.basename(file_path))
        with rasterio.open(cleaned_path, "w", **profile) as dst:
            dst.write(optimized, 1)

        # Optional PNG
        if save_png:
            plt.figure(figsize=(8, 6))
            plt.imshow(ndwi, cmap='Blues', vmin=-1, vmax=1)
            for contour in good_contours:
                plt.plot(contour[:, 1], contour[:, 0], color='red', linewidth=1.5)
            plt.axis('off')
            png_path = os.path.join(output_folder, f"plot_{os.path.splitext(os.path.basename(file_path))[0]}.png")
            plt.savefig(png_path, bbox_inches='tight', dpi=150)
            plt.close()

        return cleaned_path, good_contours

    # -----------------------------
    # Helper: Auto-crop black borders
    # -----------------------------
    def auto_crop_black_borders_geo(input_tif):
        folder, filename = os.path.split(input_tif)
        tmp_path = os.path.join(folder, f"tmp_{filename}")
        with rasterio.open(input_tif) as src:
            profile = src.profile.copy()
            img = src.read()
            rows, cols = img.shape[1], img.shape[2]
            nodata = src.nodata
            if nodata is None:
                nonblack_mask = np.any(img > 0, axis=0)
            else:
                nonblack_mask = np.any(img != nodata, axis=0)

            row_nonblack_frac = np.mean(nonblack_mask, axis=1)
            col_nonblack_frac = np.mean(nonblack_mask, axis=0)

            row_inds = np.where(row_nonblack_frac > edge_frac_thresh)[0]
            col_inds = np.where(col_nonblack_frac > edge_frac_thresh)[0]
            if row_inds.size == 0 or col_inds.size == 0:
                return False

            rmin, rmax = int(row_inds[0]), int(row_inds[-1])
            cmin, cmax = int(col_inds[0]), int(col_inds[-1])

            rmin = max(rmin - buffer_pixels, 0)
            rmax = min(rmax + buffer_pixels, rows - 1)
            cmin = max(cmin - buffer_pixels, 0)
            cmax = min(cmax + buffer_pixels, cols - 1)

            window = Window.from_slices((rmin, rmax + 1), (cmin, cmax + 1))
            out_image = src.read(window=window)
            out_transform = src.window_transform(window)
            profile.update({"height": out_image.shape[1], "width": out_image.shape[2], "transform": out_transform})

        with rasterio.open(tmp_path, "w", **profile) as dst:
            dst.write(out_image)

        shutil.move(tmp_path, input_tif)
        return True

    # -----------------------------
    # Process folder
    # -----------------------------
    for file_name in os.listdir(input_folder):
        if not file_name.lower().endswith((".tif", ".tiff")):
            continue
        file_path = os.path.join(input_folder, file_name)
        result = process_ndwi_file(file_path)
        if result:
            results.append(result)
            # Auto-crop
            auto_crop_black_borders_geo(os.path.join(output_folder, file_name))
    return results
