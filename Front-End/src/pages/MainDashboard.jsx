import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [images, setImages] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/dashboard-data/`) // ✅ backend should return { summary, images, logs }
      .then((res) => {
        setSummary(res.data.summary);
        setImages(res.data.images);
        setLogs(res.data.logs);
      })
      .catch((err) => console.error("❌ Dashboard fetch failed:", err));
  }, []);

  if (!summary)
    return (
      <div className="p-6 text-gray-700">
        Please Select an AOI from the Map to start seeing the Dashboard
      </div>
    );

  // Charts
  const waterVsLandData = {
    labels: summary.years,
    datasets: [
      {
        label: "Water %",
        data: summary.water_percent,
        backgroundColor: "rgba(59, 130, 246, 0.7)",
      },
      {
        label: "Land %",
        data: summary.land_percent,
        backgroundColor: "rgba(16, 185, 129, 0.7)",
      },
    ],
  };

  const ndwiTrendData = {
    labels: summary.years,
    datasets: [
      {
        label: "Mean NDWI",
        data: summary.mean_ndwi,
        borderColor: "rgba(59, 130, 246, 1)",
        backgroundColor: "rgba(59, 130, 246, 0.3)",
        tension: 0.3,
        fill: true,
        pointRadius: 4,
      },
    ],
  };

  return (
    <div className="bg-gray-100 p-6 min-h-screen flex flex-col gap-6">
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
    <div className="bg-white shadow-lg rounded-lg p-5 flex flex-col items-center">
      <p className="text-gray-500">AOI Area (km²)</p>
      <h2 className="text-2xl font-bold">{summary.aoi_km2.toFixed(2)}</h2>
    </div>
    <div className="bg-white shadow-lg rounded-lg p-5 flex flex-col items-center">
      <p className="text-gray-500">AOI Area (m²)</p>
      <h2 className="text-2xl font-bold">{summary.aoi_m2.toLocaleString()}</h2>
    </div>
    <div className="bg-white shadow-lg rounded-lg p-5 flex flex-col items-center">
      <p className="text-gray-500">Images Downloaded</p>
      <h2 className="text-2xl font-bold">{summary.num_images}</h2>
    </div>
    <div className="bg-white shadow-lg rounded-lg p-5 flex flex-col items-center">
      <p className="text-gray-500">Years Covered</p>
      <h2 className="text-2xl font-bold">{summary.start_year} - {summary.end_year}</h2>
    </div>
    <div className="bg-white shadow-lg rounded-lg p-5 flex flex-col items-center border-b-4 border-purple-500">
      <p className="text-gray-500">Prediction Target</p>
      <h2 className="text-2xl font-bold text-purple-600">{summary.prediction_year || 2025}</h2>
    </div>
  </div>

  {/* Coordinates Display */}
  {summary.coordinates && summary.coordinates.length > 0 && (
    <div className="bg-white shadow-lg rounded-lg p-5">
      <h3 className="font-semibold mb-2 text-gray-700">Selected AOI Coordinates (Longitude, Latitude)</h3>
      <div className="bg-gray-50 border p-3 rounded h-32 overflow-y-auto text-sm font-mono text-gray-600">
        {summary.coordinates.map((poly, i) => {
          // Normalize the nesting: extract the actual coordinate pairs
          // If poly[0] is an array of arrays, we need to unwrap it
          let ring = poly;
          if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
            ring = ring[0];
          }
          if (Array.isArray(ring[0]) && Array.isArray(ring[0][0])) {
            ring = ring[0];
          }

          return (
            <div key={i} className="mb-2">
              <strong>Polygon {i+1}:</strong>
              <ul className="ml-4 list-disc list-inside">
                {ring.map((coord, j) => {
                  if (!coord || typeof coord[0] !== 'number') return null;
                  return (
                    <li key={j}>[{coord[0].toFixed(5)}, {coord[1].toFixed(5)}]</li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* Middle: Charts */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <div className="bg-white shadow-lg rounded-lg p-5 h-80">
      <h3 className="font-semibold mb-4">Water vs Land % per Year</h3>
      <Bar
        data={waterVsLandData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
        }}
        className="h-full"
      />
    </div>
    <div className="bg-white shadow-lg rounded-lg p-5 h-80">
      <h3 className="font-semibold mb-4">NDWI Trend</h3>
      <Line
        data={ndwiTrendData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
        }}
        className="h-full"
      />
    </div>
  </div>

  {/* Bottom: Images + Logs */}
  <div className="flex gap-6 overflow-hidden flex-grow">
    {/* Images Gallery */}
    <div className="bg-white shadow-lg rounded-lg p-5 flex-1 overflow-y-auto">
      <h3 className="font-semibold mb-4">Extracted NDWI Images</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img) => (
          <div
            key={img.year}
            className="border rounded-lg overflow-hidden shadow hover:shadow-xl transition-shadow cursor-pointer"
          >
            <img
              src={`${API_URL}${img.thumbnail_url}`}
              alt={`NDWI ${img.year}`}
              className="w-full h-32 object-cover"
            />
            <div className="p-2 text-center bg-gray-50">{img.year}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Logs */}
    <div className="bg-white shadow-lg rounded-lg p-5 w-1/3 overflow-y-auto">
      <h3 className="font-semibold mb-4">Backend Logs</h3>
      <ul className="text-sm text-gray-700 space-y-1">
        {logs.map((log, idx) => (
          <li key={idx}>• {log}</li>
        ))}
      </ul>
    </div>
  </div>
</div>


  );
};

export default Dashboard;
