import React, { useEffect, useState } from "react";
import axios from "axios";
import Map from "../components/ui/Map";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const ResultsVisualization = () => {
  const [shorelineData, setShorelineData] = useState(null);
  const [erosionGeoJSON, setErosionGeoJSON] = useState(null);
  const [stats, setStats] = useState(null);
  const [predictionYear, setPredictionYear] = useState(2025);

  useEffect(() => {
    // Fetch shorelines (WGS84 converted geojson)
    axios.get(`${API_URL}/extracted-shorelines/`)
      .then(res => setShorelineData(res.data))
      .catch(err => console.error(err));

    // Fetch erosion geojson
    axios.get(`${API_URL}/erosion-geojson/`)
      .then(res => setErosionGeoJSON(res.data))
      .catch(err => console.error(err));

    // Fetch dashboard data for stats
    axios.get(`${API_URL}/api/dashboard-data/`)
      .then(res => {
        if (res.data.summary.erosion_stats) {
          setStats(res.data.summary.erosion_stats);
        }
        if (res.data.summary.prediction_year) {
          setPredictionYear(res.data.summary.prediction_year);
        } else {
          setPredictionYear(2025);
        }
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-white relative pt-16">
      <div className="flex-1 relative overflow-hidden shadow-xl m-4 rounded-xl border border-white/10">
        <Map shorelineData={shorelineData} erosionGeoJSON={erosionGeoJSON} />
      </div>
      <div className="h-48 bg-slate-800 p-6 flex flex-col items-center justify-center border-t border-slate-700 shadow-2xl glass-panel">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-300 mb-3">
          Erosion & Accretion Snapshot
        </h2>
        <p className="text-slate-300 text-center max-w-3xl leading-relaxed text-lg">
          <span className="font-semibold text-rose-400">Note:</span> The map above visualizes coastal changes up to the prediction year <strong className="text-white">{predictionYear}</strong>. 
          {stats && ` Overall, the area experienced `}
          {stats && <span className="text-rose-400 font-bold">{stats.erosion_percent.toFixed(1)}% erosion</span>}
          {stats && ` and `}
          {stats && <span className="text-teal-400 font-bold">{stats.accretion_percent.toFixed(1)}% accretion</span>}
          {stats && `.`}
        </p>
      </div>
    </div>
  );
};

export default ResultsVisualization;
