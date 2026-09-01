import React, { useState } from "react";
import Map from "../components/ui/Map";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const LandingPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logs, setLogs] = useState("Draw a square on the map, then click a button below.");
  const [coordinates, setCoordinates] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ndwiImages, setNdwiImages] = useState([]);
  const [shorelineData, setShorelineData] = useState(null);
  const [transectsData, setTransectsData] = useState(null);
  const [erosionResults, setErosionResults] = useState(null);
  const [erosionGeoJSON, setErosionGeoJSON] = useState(null);
  const [predictionYear, setPredictionYear] = useState(2025);

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
      const response = await fetch(`${API_URL}/extract-images/`, {
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
          url: `${API_URL}/static/plot_NDWI_${r.year}.png?t=${Date.now()}`,
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
      const response = await fetch(`${API_URL}/clean-images/`, { method: "POST" });
      const data = await response.json();
      addLog(`✅ Cleaned: ${(data.processed_files || []).join(", ")}`);
      
      // Update gallery with cleaned images
      const images = (data.processed_files || []).map((filename) => {
        const year = filename.match(/\d{4}/)?.[0] || "Unknown";
        return {
          year: year,
          url: `${API_URL}/static/plot_${filename.replace(".tif", ".png")}?t=${Date.now()}`,
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
      const response = await fetch(`${API_URL}/extract-shorelines/`, { method: "POST" });
      const data = await response.json();
      addLog(`✅ ${data.message}`);
      
      // Fetch and display the newly extracted shorelines
      fetchExtractedShorelines();
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExtractedShorelines = async () => {
    addLog("⏳ Loading extracted shorelines onto map...");
    try {
      const response = await fetch(`${API_URL}/extracted-shorelines/`);
      const data = await response.json();
      setShorelineData(data);
      addLog("✅ Extracted shorelines displayed!");
    } catch (err) {
      addLog(`❌ Error loading extracted shorelines: ${err.message}`);
    }
  };

  // ── Generate Transects ───────────────────────────────────────────────────
  const handleGenerateTransects = async () => {
    setIsLoading(true);
    addLog("⏳ Generating transects...");
    try {
      const response = await fetch(`${API_URL}/generate-transects/`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Server error");
      addLog(`✅ ${data.message || 'Transects generated'}`);

      // Fetch and display transects on map
      addLog("⏳ Loading transects onto map...");
      const transectsResponse = await fetch(`${API_URL}/transects/`);
      if (!transectsResponse.ok) throw new Error(`Failed to load transects: ${transectsResponse.status}`);
      const transectsJson = await transectsResponse.json();
      setTransectsData(transectsJson);
      
      if (!transectsJson.features || transectsJson.features.length === 0) {
        addLog("⚠️ No transects were found. Make sure you extracted shorelines first.");
        alert("No transects could be generated. This usually happens if there is no visible shoreline in your drawn box, or if you skipped Step 3 (Extract Shorelines).");
      } else {
        addLog("✅ Transects displayed!");
      }
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Predict Shoreline ───────────────────────────────────────────────────
  const handlePredictShoreline = async () => {
    setIsLoading(true);
    addLog(`⏳ Predicting shoreline for ${predictionYear}...`);
    try {
      const response = await fetch(`${API_URL}/predict-shoreline/?future_year=${predictionYear}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Failed to predict shoreline");
      }
      addLog(`✅ ${data.message || 'Prediction successful'}`);
      
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
      const response = await fetch(`${API_URL}/shoreline-data/`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Failed to load shoreline data");
      }
      setShorelineData(data);
      addLog("✅ Shoreline points loaded onto map!");
    } catch (err) {
      addLog(`❌ Error loading shoreline: ${err.message}`);
    }
  };

  // ── Calculate Erosion/Accretion ──────────────────────────────────────────
  const handleCalculateErosion = async () => {
    setIsLoading(true);
    addLog(`⏳ Calculating erosion and accretion...`);
    try {
      const response = await fetch(`${API_URL}/calculate-erosion/?future_year=${predictionYear}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Failed to calculate erosion");
      }
      
      const results = data.details || data;
      setErosionResults(results);
      setErosionGeoJSON(data.geojson);
      
      // Save globally for Analysis Workspace to read dynamically!
      localStorage.setItem("erosionData", JSON.stringify(results));
      
      addLog(`✅ Erosion calculation complete! Map updated.`);
    } catch (err) {
      addLog(`❌ Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 text-white relative">
      {/* Map Background Layer */}
      <div className="absolute inset-0 z-0">
        <Map 
          onCoordinatesReady={handleCoordinatesReady} 
          shorelineData={shorelineData} 
          erosionGeoJSON={erosionGeoJSON}
          transectsData={transectsData} 
        />
      </div>

      {/* Toggle Button for Mobile/Desktop to hide panel */}
      <button
        className="absolute top-24 right-6 z-50 p-3 glass-card rounded-full hover:bg-white/10 transition-colors"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Floating 3D Control Panel */}
      <div
        className={`absolute top-24 right-6 bottom-6 w-96 glass-card rounded-3xl transition-all duration-500 transform ${
          sidebarOpen ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0"
        } flex flex-col overflow-hidden z-40`}
      >
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar custom-scrollbar">
          <h2 className="text-xl font-bold mb-6 text-slate-100 flex items-center gap-2">
            <span className="text-blue-400">⚡</span> Analysis Pipeline
          </h2>

          {/* Pipeline Buttons */}
          <div className="flex flex-col space-y-4">
            <button
              onClick={handleExtractImages}
              disabled={isLoading}
              className="btn-3d w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center justify-between"
            >
              <span>1. Extract NDWI</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Step 1</span>
            </button>
            
            <button
              onClick={handleCleanImages}
              disabled={isLoading}
              className="btn-3d w-full px-5 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center justify-between"
            >
              <span>2. Clean Images</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Step 2</span>
            </button>
            
            <button
              onClick={handleExtractShorelines}
              disabled={isLoading}
              className="btn-3d w-full px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center justify-between"
            >
              <span>3. Extract Shorelines</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Step 3</span>
            </button>
            
            <button
              onClick={handleGenerateTransects}
              disabled={isLoading}
              className="btn-3d w-full px-5 py-3 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center justify-between"
            >
              <span>4. Gen Transects</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Step 4</span>
            </button>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-2 text-sm text-slate-300">
                <label>Prediction Year:</label>
                <input 
                  type="number" 
                  value={predictionYear}
                  onChange={(e) => setPredictionYear(e.target.value)}
                  className="bg-black/40 border border-white/20 rounded px-2 py-1 w-20 text-white text-center focus:outline-none focus:border-purple-500"
                />
              </div>
              <button
                onClick={handlePredictShoreline}
                disabled={isLoading}
                className="btn-3d w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center justify-between"
              >
                <span>5. AI Prediction</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Step 5</span>
              </button>
            </div>
            
            <button
              onClick={handleCalculateErosion}
              disabled={isLoading}
              className="btn-3d w-full px-5 py-3 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center justify-between"
            >
              <span>6. Erosion Stats</span>
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs">Final</span>
            </button>
          </div>

          {/* Results Display */}
          {erosionResults && (
            <div className="mt-6 p-5 glass-card border border-rose-500/30 rounded-2xl card-3d">
              <h3 className="font-bold text-rose-400 mb-3 flex items-center gap-2">
                <span>📊</span> Results
              </h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>Avg Rate</span>
                  <span className="font-mono text-white">{erosionResults.stats.mean_rate?.toFixed(3)} m/yr</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>Erosion</span>
                  <span className="font-mono text-rose-300">{erosionResults.stats.erosion_percent?.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-1">
                  <span>Accretion</span>
                  <span className="font-mono text-teal-300">{erosionResults.stats.accretion_percent?.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="mt-6 p-4 glass-card bg-black/40 rounded-2xl border border-white/10 overflow-y-auto custom-scrollbar h-32 font-mono text-[11px] text-slate-300 shadow-inner">
            <h3 className="font-semibold mb-2 text-slate-400 uppercase tracking-wider text-[10px]">System Terminal</h3>
            <pre className="whitespace-pre-wrap">{logs}</pre>
          </div>

          {/* NDWI Images Gallery */}
          {ndwiImages.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3 text-sm text-slate-300 uppercase tracking-wider">NDWI Visuals</h3>
              <div className="grid grid-cols-2 gap-3">
                {ndwiImages.map((img) => (
                  <div key={img.year} className="relative rounded-xl overflow-hidden group card-3d border border-white/10">
                    <img
                      src={img.url}
                      alt={`NDWI ${img.year}`}
                      className="w-full h-24 object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-center pb-2">
                      <span className="text-[11px] font-bold text-white tracking-widest">{img.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
