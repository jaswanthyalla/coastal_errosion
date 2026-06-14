import os
import math
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, Point

def process_shorelines_transects(
    gdf,
    n_years=3,
    transect_length=2000,
    spacing=100,
    baseline_file="baseline_shoreline.geojson",
    transects_file="transects.geojson",
    shoreline_csv="shoreline_timeseries_fast.csv"
):
    """
    Complete pipeline:
    1️⃣ Generate baseline from first n_years
    2️⃣ Generate transects along baseline
    3️⃣ Extract shoreline distances along transects
    """

    # -----------------------------
    # 1️⃣ Generate baseline
    # -----------------------------
    early_years = gdf[gdf['year'].isin(sorted(gdf['year'].unique())[:n_years])]
    baseline_geom = early_years.unary_union
    baseline_gdf = gpd.GeoDataFrame(geometry=[baseline_geom], crs=gdf.crs)
    baseline_gdf.to_file(baseline_file, driver="GeoJSON")

    # -----------------------------
    # 2️⃣ Generate transects
    # -----------------------------
    transects = []
    lines = [baseline_geom] if isinstance(baseline_geom, LineString) else list(baseline_geom.geoms)

    for line in lines:
        line_len = line.length
        n_transects = max(int(line_len // spacing), 1)
        for i in range(n_transects):
            d = i * spacing
            step = min(spacing / 10, line_len - d)
            if step <= 0:
                continue
            p = line.interpolate(d)
            p_next = line.interpolate(d + step)
            dx, dy = p_next.x - p.x, p_next.y - p.y
            length = math.hypot(dx, dy)
            if length == 0:
                continue
            nx, ny = -dy / length, dx / length
            x1, y1 = p.x - nx * transect_length / 2, p.y - ny * transect_length / 2
            x2, y2 = p.x + nx * transect_length / 2, p.y + ny * transect_length / 2
            transects.append(LineString([(x1, y1), (x2, y2)]))

    transects_gdf = gpd.GeoDataFrame({"Transect": range(len(transects)), "geometry": transects}, crs=gdf.crs)
    transects_gdf.to_file(transects_file, driver="GeoJSON")

    # -----------------------------
    # 3️⃣ Extract shoreline distances
    # -----------------------------
    gdf_sindex = gdf.sindex
    records = []

    def extract_points(inter):
        pts = []
        if inter.is_empty:
            return pts
        if inter.geom_type == "Point":
            pts.append(inter)
        elif inter.geom_type == "MultiPoint":
            pts.extend(list(inter.geoms))
        elif inter.geom_type == "LineString":
            pts.append(Point(inter.coords[0]))
            pts.append(Point(inter.coords[-1]))
        elif inter.geom_type == "MultiLineString":
            for line in inter.geoms:
                pts.append(Point(line.coords[0]))
                pts.append(Point(line.coords[-1]))
        elif inter.geom_type == "GeometryCollection":
            for geom in inter.geoms:
                pts.extend(extract_points(geom))
        return pts

    for t_idx, transect in enumerate(transects_gdf.geometry):
        candidates_idx = list(gdf_sindex.intersection(transect.bounds))
        candidates = gdf.iloc[candidates_idx]
        for year, group in candidates.groupby("year"):
            distances = []
            for shoreline in group.geometry:
                inter = shoreline.intersection(transect)
                pts = extract_points(inter)
                distances.extend([transect.project(pt) for pt in pts])
            if distances:
                records.append({
                    "Year": year,
                    "Transect": t_idx,
                    "Shoreline_Distance": max(distances)
                })

    shoreline_df = pd.DataFrame(records)
    shoreline_df.to_csv(shoreline_csv, index=False)

    # Return everything
    return {
        "baseline_gdf": baseline_gdf,
        "transects_gdf": transects_gdf,
        "shoreline_df": shoreline_df
    }
