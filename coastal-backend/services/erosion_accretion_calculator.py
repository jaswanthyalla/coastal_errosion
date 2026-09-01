# erosion_accretion.py
import os
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

def calculate_erosion_accretion(
    transects_file="transects.geojson",
    shoreline_base_file=os.path.join("data", "shorelines_data","shoreline_2016.geojson"),
    shoreline_future_file=os.path.join("data", "shorelines_data","shoreline_2025.geojson"),
    base_year=2016,
    future_year=2025
):
    """
    Calculate erosion/accretion along transects between two shorelines.

    Returns:
        dict: {
            "results": list of dicts per transect,
            "stats": mean, median, erosion%, accretion%, stable%
        }
    """
    # 1️⃣ Load data
    def safe_read(file_path):
        gdf = gpd.read_file(file_path)
        # If coordinates are very large (UTM), they are definitely not WGS84
        if gdf.crs is None or gdf.crs.to_epsg() == 4326:
            # Check bounds to guess if it's already UTM but mislabeled as WGS84
            bounds = gdf.total_bounds
            if bounds[0] > 180 or bounds[1] > 90:
                gdf.set_crs(epsg=32644, allow_override=True, inplace=True)
        return gdf.to_crs(epsg=32644)

    shoreline_base = safe_read(shoreline_base_file)
    shoreline_future = safe_read(shoreline_future_file)
    transects = safe_read(transects_file)

    # Merge geometries
    shoreline_base_union = shoreline_base.geometry.union_all()
    shoreline_future_union = shoreline_future.geometry.union_all()

    # 2️⃣ Helper to safely get a Point from intersection
    def get_point(inter, ref_line):
        if inter.is_empty:
            return None
        elif inter.geom_type == "Point":
            return inter
        elif inter.geom_type in ["MultiPoint", "GeometryCollection"]:
            pts = []
            if inter.geom_type == "MultiPoint":
                pts = list(inter.geoms)
            elif inter.geom_type == "GeometryCollection":
                for g in inter.geoms:
                    if g.geom_type == "Point":
                        pts.append(g)
            if pts:
                return min(pts, key=lambda p: p.distance(ref_line.centroid))
        elif inter.geom_type == "LineString":
            return Point(inter.coords[int(len(inter.coords)/2)])
        return None

    from pyproj import Transformer
    transformer = Transformer.from_crs("EPSG:32644", "EPSG:4326", always_xy=True)

    # 3️⃣ Calculate change along transects
    results = []
    features = []

    for t_idx in transects["Transect"].unique():
        t_line = transects[transects["Transect"] == t_idx].geometry.iloc[0]
        
        # Intersections
        base_inter = t_line.intersection(shoreline_base_union)
        base_pt = get_point(base_inter, t_line)
        
        # Future point lookup by Transect ID (much more robust than point-line intersection)
        fut_row = shoreline_future[shoreline_future["Transect"] == t_idx]
        if not fut_row.empty:
            fut_pt = fut_row.iloc[0].geometry
        else:
            fut_pt = None

        if base_pt and fut_pt:
            dist_signed = base_pt.distance(fut_pt)
            
            # Determine sign (erosion vs accretion)
            # Compare distances from landward start of transect
            dist_base_from_start = t_line.project(base_pt)
            dist_fut_from_start = t_line.project(fut_pt)
            
            # If future is further along the transect (towards sea), it's accretion (+)
            # If future is closer to land (smaller distance), it's erosion (-)
            if dist_fut_from_start < dist_base_from_start:
                dist_signed = -dist_signed

            results.append({
                "Transect": t_idx,
                "erosion_accretion_m": dist_signed
            })

            base_lon, base_lat = transformer.transform(base_pt.x, base_pt.y)
            fut_lon, fut_lat = transformer.transform(fut_pt.x, fut_pt.y)

            is_erosion = dist_signed < 0
            features.append({
                "type": "Feature",
                "properties": {
                    "type": "erosion" if is_erosion else "accretion",
                    "rate": dist_signed
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[base_lon, base_lat], [fut_lon, fut_lat]]
                }
            })

    # 4️⃣ Calculate rate per year
    for r in results:
        years_diff = future_year - base_year
        r["rate_m_per_year"] = r["erosion_accretion_m"] / years_diff if years_diff > 0 else None

    # 5️⃣ Summary stats
    df = pd.DataFrame(results)
    
    if df.empty:
        # Fallback if no intersections were found
        stats = {
            "mean_rate": 0, "median_rate": 0, "erosion_percent": 0, 
            "accretion_percent": 0, "stable_percent": 100
        }
    else:
        stats = {
            "mean_rate": float(df["rate_m_per_year"].mean()),
            "median_rate": float(df["rate_m_per_year"].median()),
            "erosion_percent": float((df["rate_m_per_year"] < 0).mean() * 100),
            "accretion_percent": float((df["rate_m_per_year"] > 0).mean() * 100),
            "stable_percent": float(100 - ((df["rate_m_per_year"] < 0).mean() + (df["rate_m_per_year"] > 0).mean())*100)
        }

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    import json
    with open("data/erosion_results.geojson", "w") as f:
        json.dump(geojson, f)

    return {"results": df.to_dict(orient="records"), "stats": stats, "geojson": geojson}
