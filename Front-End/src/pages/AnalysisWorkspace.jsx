import React, { useState, useEffect } from "react";

const AnalysisWorkspace = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const savedData = localStorage.getItem("erosionData");
    if (savedData) {
      try {
        setData(JSON.parse(savedData));
      } catch (err) {
        console.error("Failed to parse erosion data", err);
      }
    }
  }, []);

  const erosion = data?.stats?.erosion_percent || data?.erosion_percent || 0;
  const stable = data?.stats?.stable_percent || data?.stable_percent || 0;
  const accretion = data?.stats?.accretion_percent || data?.accretion_percent || 0;
  const meanRate = data?.stats?.mean_rate || data?.mean_rate || 0;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 text-white relative items-center justify-center pt-20 pb-10">
      
      {/* Background ambient light */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl w-full mx-auto p-8 glass-card rounded-3xl text-center shadow-2xl relative z-10 flex flex-col items-center">
        
        <div className="w-20 h-20 mb-6 rounded-full bg-gradient-to-tr from-blue-500 to-teal-400 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)]">
          <span className="text-4xl">📊</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-300 mb-4 drop-shadow-sm">
          Advanced Analytics Hub
        </h1>
        
        <p className="text-slate-300 text-lg max-w-2xl mb-12">
          {data 
            ? "Live data streaming from your most recent geospatial analysis." 
            : "No analysis data found. Please run the AI pipeline on the main map first!"}
        </p>

        {/* Dynamic Dashboard UI */}
        <div className={`w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left transition-opacity duration-500 ${!data ? 'opacity-40 grayscale' : 'opacity-100'}`}>
          
          <div className="p-6 glass-panel rounded-2xl border border-white/5 bg-white/5">
            <h3 className="text-slate-400 font-semibold mb-2 text-sm uppercase tracking-wider">Average Shift Rate</h3>
            <div className="flex flex-col items-center justify-center h-full pb-8">
              <span className={`text-5xl font-mono font-bold ${meanRate < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {meanRate > 0 ? '+' : ''}{meanRate.toFixed(2)}
              </span>
              <span className="text-sm text-slate-500 mt-2">meters per year</span>
            </div>
          </div>

          <div className="p-6 glass-panel rounded-2xl border border-white/5 bg-white/5">
            <h3 className="text-slate-400 font-semibold mb-2 text-sm uppercase tracking-wider">Risk Distribution</h3>
            <div className="flex flex-col gap-4 mt-6">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-rose-400">Erosion Area</span><span>{erosion.toFixed(1)}%</span></div>
                <div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-rose-500 h-2 rounded-full transition-all duration-1000" style={{width: `${erosion}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Stable Area</span><span>{stable.toFixed(1)}%</span></div>
                <div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-slate-500 h-2 rounded-full transition-all duration-1000" style={{width: `${stable}%`}}></div></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-emerald-400">Accretion Area</span><span>{accretion.toFixed(1)}%</span></div>
                <div className="w-full bg-slate-800 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{width: `${accretion}%`}}></div></div>
              </div>
            </div>
          </div>

          <div className="p-6 glass-panel rounded-2xl border border-white/5 bg-white/5 flex flex-col items-center justify-center">
            <h3 className="text-slate-400 font-semibold mb-4 text-sm uppercase tracking-wider text-center">Prediction AI</h3>
            <div className="w-32 h-32 rounded-full border-8 border-slate-800 border-t-purple-500 border-r-purple-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">98%</span>
            </div>
            <span className="text-xs text-slate-500 mt-2">Model Confidence</span>
          </div>

        </div>
        
        {!data && (
          <div className="mt-10 px-6 py-2 bg-rose-900/40 rounded-full border border-rose-500/30">
            <span className="text-sm text-rose-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Waiting for Analysis
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisWorkspace;
