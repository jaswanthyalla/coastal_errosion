# hyperparameter_tuning.py
import pandas as pd
import numpy as np
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error
from math import sqrt

def tune_polynomial_regression(
    csv_file="shoreline_timeseries_fast.csv",
    validation_years=None,
    degrees=None
):
    """
    Performs polynomial regression hyperparameter tuning for shoreline data.

    Args:
        csv_file (str): CSV with columns ["Transect", "Year", "Shoreline_Distance"]
        validation_years (list): years to validate
        degrees (list): polynomial degrees to test

    Returns:
        dict: {
            "results": DataFrame of all MAE/RMSE results,
            "best_per_year": dict of best degree per validation year,
            "best_degree_mae": degree with lowest avg MAE,
            "best_degree_rmse": degree with lowest avg RMSE
        }
    """
    if validation_years is None:
        validation_years = [2017, 2020, 2025]
    if degrees is None:
        degrees = [1, 2, 3, 4]

    df = pd.read_csv(csv_file)
    df_yearly = df.groupby(["Transect", "Year"])["Shoreline_Distance"].mean().reset_index()

    results = []
    best_per_year = {}

    for val_year in validation_years:
        best_mae, best_rmse, best_degree = float("inf"), None, None

        for degree in degrees:
            y_true, y_pred = [], []

            for t_idx in df_yearly["Transect"].unique():
                df_t = df_yearly[df_yearly["Transect"] == t_idx]
                X = df_t["Year"].values.reshape(-1, 1)
                y = df_t["Shoreline_Distance"].values

                if len(y) < degree + 1:
                    continue

                poly = PolynomialFeatures(degree=degree)
                X_poly = poly.fit_transform(X)

                model = LinearRegression()
                model.fit(X_poly, y)

                if val_year in df_t["Year"].values:
                    true_dist = df_t.loc[df_t["Year"] == val_year, "Shoreline_Distance"].values[0]
                    pred_dist = model.predict(poly.transform([[val_year]]))[0]

                    y_true.append(true_dist)
                    y_pred.append(pred_dist)

            if len(y_true) > 0:
                mae = mean_absolute_error(y_true, y_pred)
                rmse = sqrt(mean_squared_error(y_true, y_pred))
                results.append({"Degree": degree, "Validation_Year": val_year, "MAE": mae, "RMSE": rmse})

                if mae < best_mae:
                    best_mae, best_rmse, best_degree = mae, rmse, degree

        best_per_year[val_year] = {"Best_Degree": best_degree, "MAE": best_mae, "RMSE": best_rmse}

    results_df = pd.DataFrame(results)

    avg_mae = results_df.groupby("Degree")["MAE"].mean()
    avg_rmse = results_df.groupby("Degree")["RMSE"].mean()

    best_degree_mae = int(avg_mae.idxmin())
    best_degree_rmse = int(avg_rmse.idxmin())

    return {
        "results": results_df,
        "best_per_year": best_per_year,
        "best_degree_mae": best_degree_mae,
        "best_degree_rmse": best_degree_rmse
    }
