# poly_prediction.py
import geopandas as gpd
import pandas as pd
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression

def predict_shoreline(
    df_csv="shoreline_timeseries_fast.csv",
    transects_file="transects.geojson",
    shorelines_file="shorelines.geojson",
    future_year=2030,
    poly_degree=None
):
    """
    Predict shoreline positions for a future year using polynomial regression.

    Args:
        df_csv (str): Path to shoreline time-series CSV
        transects_file (str): Path to transects GeoJSON
        shorelines_file (str): Path to shorelines GeoJSON
        future_year (int): Year to predict
        poly_degree (int): Degree of polynomial. If None, uses degree 2

    Returns:
        dict: {
            "predicted_points": GeoJSON-like dict,
            "poly_degree": degree used
        }
    """
    # 1️⃣ Load data
    df = pd.read_csv(df_csv)
    df_yearly = df.groupby(["Transect", "Year"])["Shoreline_Distance"].mean().reset_index()
    transects = gpd.read_file(transects_file).to_crs(epsg=32644)

    if poly_degree is None:
        poly_degree = 2

    # 2️⃣ Predict
    pred_points = []
    for t_idx in df_yearly["Transect"].unique():
        df_t = df_yearly[df_yearly["Transect"] == t_idx]

        # Exclude 2025 for training
        df_train = df_t[df_t["Year"] < 2025]
        X = df_train["Year"].values.reshape(-1, 1)
        y = df_train["Shoreline_Distance"].values

        if len(y) < 2:
            continue

        poly = PolynomialFeatures(degree=poly_degree)
        X_poly = poly.fit_transform(X)
        model = LinearRegression()
        model.fit(X_poly, y)
        dist_future = model.predict(poly.transform([[future_year]]))[0]

        # Safe transect lookup
        row = transects.loc[transects["Transect"] == t_idx]
        if row.empty:
            continue
        tran = row.iloc[0].geometry
        point_pred = tran.interpolate(dist_future)
        pred_points.append({"Transect": t_idx, "geometry": point_pred})

    # 3️⃣ Convert to GeoDataFrame
    pred_gdf = gpd.GeoDataFrame(pred_points, crs=transects.crs)

    # Return as GeoJSON-like dict
    return {
        "predicted_points": pred_gdf.__geo_interface__,
        "poly_degree": poly_degree
    }
