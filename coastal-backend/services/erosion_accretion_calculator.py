# erosion_accretion.py
import os
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

def calculate_erosion_accretion(
    transects_file="transects.geojson",
    shoreline_base_file=os.path.join("shorelines_data","shoreline_2016.geojson"),
    shoreline_future_file=os.path.join("shorelines_data","shoreline_2025.geojson"),
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
    shoreline_base = gpd.read_file(shoreline_base_file).to_crs(epsg=32644)
    shoreline_future = gpd.read_file(shoreline_future_file).to_crs(epsg=32644)
    transects = gpd.read_file(transects_file).to_crs(epsg=32644)

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

    # 3️⃣ Calculate change along transects
    results = []
    for idx, tr in transects.iterrows():
        base_pt = get_point(tr.geometry.intersection(shoreline_base_union), tr.geometry)
        fut_pt = get_point(tr.geometry.intersection(shoreline_future_union), tr.geometry)

        if base_pt and fut_pt:
            dist = base_pt.distance(fut_pt)
            sign = 1 if fut_pt.y > base_pt.y else -1
            dist_signed = sign * dist
            results.append({
                "transect_id": idx,
                "base_year": base_year,
                "future_year": future_year,
                "erosion_accretion_m": dist_signed
            })

    # 4️⃣ Calculate rate per year
    for r in results:
        years_diff = future_year - base_year
        r["rate_m_per_year"] = r["erosion_accretion_m"] / years_diff if years_diff > 0 else None

    # 5️⃣ Summary stats
    df = pd.DataFrame(results)
    stats = {
        "mean_rate": df["rate_m_per_year"].mean(),
        "median_rate": df["rate_m_per_year"].median(),
        "erosion_percent": (df["rate_m_per_year"] < 0).mean() * 100,
        "accretion_percent": (df["rate_m_per_year"] > 0).mean() * 100,
        "stable_percent": 100 - ((df["rate_m_per_year"] < 0).mean() + (df["rate_m_per_year"] > 0).mean())*100
    }

    return {"results": df.to_dict(orient="records"), "stats": stats}
