import React, { useState } from "react";
import Map from "../components/ui/Map";

const LandingPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logs, setLogs] = useState("Draw a square on the map, then click a button below.");
  const [coordinates, setCoordinates] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ndwiImages, setNdwiImages] = useState([]);
  const [shorelineData, setShorelineData] = useState(null);
  const [erosionResults, setErosionResults] = useState(null);

  const addLog = (msg) => setLogs((prev) => prev + "\n" + msg);

  // Called automatically when the user finishes drawing a square on the map
  const handleCoordinatesReady = (coords) => {
    setCoordinates(coords);
    setLogs("✅ Area selected! Click 'Extract NDWI Images' to start downloading satellite data.");
  };

  // ── Extract NDWI Images ──────────────────────────────────────────────────
  const handleExtractImages = async () => {
    if (!coordinates) {
      return alert("⚠️ Please draw a square on the map first!");
    }
    setIsLoading(true);
    setNdwiImages([]);
    addLog("⏳ Sending coordinates to backend...");
    try {
      const response = await fetch("http://127.0.0.1:8000/extract-images/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: [coordinates] }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }
      const data = await response.json();
      addLog("✅ NDWI extraction complete!");
      // Build image URLs for years that succeeded
      const images = (data.results || [])
        .filter((r) => r.download_status === "success")
        .map((r) => ({
          year: r.year,
          url: `http://127.0.0.1:8000/static/plot_NDWI_${r.year}.png?t=${Date.now()}`,
        }));
      setNdwiImages(images);
      if (images.length === 0) addLog("⚠️ No images were generated. Check backend logs.");
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Clean NDWI Images ────────────────────────────────────────────────────
  const handleCleanImages = async () => {
    setIsLoading(true);
    addLog("⏳ Cleaning NDWI images...");
    try {
      const response = await fetch("http://127.0.0.1:8000/clean-images/", { method: "POST" });
      const data = await response.json();
      addLog(`✅ Cleaned: ${(data.processed_files || []).join(", ")}`);
      
      // Update gallery with cleaned images
      const images = (data.processed_files || []).map((filename) => {
        const year = filename.match(/\d{4}/)?.[0] || "Unknown";
        return {
          year: year,
          url: `http://127.0.0.1:8000/static/plot_${filename.replace(".tif", ".png")}?t=${Date.now()}`,
        };
      });
      setNdwiImages(images);
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Extract Shorelines ───────────────────────────────────────────────────
  const handleExtractShorelines = async () => {
    setIsLoading(true);
    addLog("⏳ Extracting shorelines...");
    try {
      const response = await fetch("http://127.0.0.1:8000/extract-shorelines/", { method: "POST" });
      const data = await response.json();
      addLog(`✅ ${data.message}`);
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Generate Transects ───────────────────────────────────────────────────
  const handleGenerateTransects = async () => {
    setIsLoading(true);
    addLog("⏳ Generating transects...");
    try {
      const response = await fetch("http://127.0.0.1:8000/generate-transects/", { method: "POST" });
      const data = await response.json();
      addLog(`✅ ${data.message}`);
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Predict Shoreline ───────────────────────────────────────────────────
  const handlePredictShoreline = async () => {
    setIsLoading(true);
    addLog("⏳ Predicting shoreline for 2025...");
    try {
      const response = await fetch("http://127.0.0.1:8000/predict-shoreline/?future_year=2025", { method: "POST" });
      const data = await response.json();
      addLog(`✅ ${data.message}`);
      
      // After predicting, fetch the shoreline data to display on map
      fetchShorelineData();
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShorelineData = async () => {
    addLog("⏳ Loading predicted shoreline points...");
    try {
      const response = await fetch("http://127.0.0.1:8000/shoreline-data/");
      const data = await response.json();
      setShorelineData(data);
      addLog("✅ Shoreline points loaded onto map!");
    } catch (err) {
      addLog(`❌ Error loading shoreline: ${err.message}`);
    }
  };

  // ── Calculate Erosion/Accretion ──────────────────────────────────────────
  const handleCalculateErosion = async () => {
    setIsLoading(true);
    addLog("⏳ Calculating erosion and accretion...");
    try {
      const response = await fetch("http://127.0.0.1:8000/calculate-erosion/", { method: "POST" });
      const data = await response.json();
      setErosionResults(data.details);
      addLog(`✅ Erosion calculation complete!`);
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between h-16 px-6 bg-gray-800 text-white">
        <h1 className="text-xl font-bold">Choose AOI from the below map</h1>
        <span className="text-sm text-gray-300">
          {coordinates ? "✅ Area selected" : "⚠️ No area selected"}
        </span>
      </header>

      {/* Main Content */}
      <div className="relative flex flex-1">
        {/* Map Area */}
        <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "mr-80" : "mr-0"}`}>
          <Map onCoordinatesReady={handleCoordinatesReady} shorelineData={shorelineData} />
        </div>

        {/* Toggle Button */}
        <button
          className="absolute top-4 right-4 z-50 px-3 py-1 bg-gray-700 text-white rounded shadow"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? "❌" : "☰"}
        </button>

        {/* Sidebar */}
        <div
          className={`fixed top-16 right-0 h-[calc(100%-64px)] w-80 bg-gray-100 border-l border-gray-300 transition-transform duration-300 overflow-y-auto ${
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="p-4 flex flex-col h-full gap-4">
            <h2 className="text-lg font-bold">Analysis Panel</h2>

            {/* Pipeline Buttons */}
            <div className="flex flex-col space-y-2">
              <button
                onClick={handleExtractImages}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                1. Extract NDWI Images
              </button>
              <button
                onClick={handleCleanImages}
                disabled={isLoading}
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
              >
                2. Clean NDWI Images
              </button>
              <button
                onClick={handleExtractShorelines}
                disabled={isLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
              >
                3. Extract Shorelines
              </button>
              <button
                onClick={handleGenerateTransects}
                disabled={isLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 text-sm font-medium"
              >
                4. Generate Transects
              </button>
              <button
                onClick={handlePredictShoreline}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                5. Predict Shoreline (AI Model)
              </button>
              <button
                onClick={handleCalculateErosion}
                disabled={isLoading}
                className="px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50 text-sm font-medium"
              >
                6. Calculate Erosion/Accretion
              </button>
            </div>

            {/* Results Display */}
            {erosionResults && (
              <div className="p-3 bg-white rounded border border-rose-200 shadow-sm">
                <h3 className="font-bold text-rose-700 mb-2">Erosion Analysis</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-semibold">Average Rate:</span> {erosionResults.stats.mean_rate?.toFixed(3)} m/yr</p>
                  <p><span className="font-semibold">Erosion:</span> {erosionResults.stats.erosion_percent?.toFixed(1)}%</p>
                  <p><span className="font-semibold">Accretion:</span> {erosionResults.stats.accretion_percent?.toFixed(1)}%</p>
                  <p className="mt-2 text-xs text-gray-500 italic">* Positive rate = Accretion, Negative = Erosion</p>
                </div>
              </div>
            )}

            {/* Logs */}
            <div className="p-2 bg-slate-800 text-slate-100 rounded border border-slate-700 overflow-y-auto max-h-40 font-mono text-[10px]">
              <h3 className="font-semibold mb-1 text-slate-400">Process Logs</h3>
              <pre className="whitespace-pre-wrap">{logs}</pre>
            </div>

            {/* NDWI Images Gallery */}
            {ndwiImages.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-sm">NDWI Gallery</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ndwiImages.map((img) => (
                    <div key={img.year} className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
                      <img
                        src={img.url}
                        alt={`NDWI ${img.year}`}
                        className="w-full h-24 object-cover"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                      <p className="text-center text-[10px] font-bold py-1 bg-gray-50">{img.year}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
