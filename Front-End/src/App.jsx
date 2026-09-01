// src/App.jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/ui/Header";
import ScrollToTop from "./components/ui/ScrollToTop";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import LandingPage from "./pages/LandingPage";
import MainDashboard from "./pages/MainDashboard";
import AnalysisWorkspace from "./pages/AnalysisWorkspace";
import ResultsVisualization from "./pages/ResultsVisualization";

function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Header />
      {/* Main container fills full screen */}
      <main className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/main-dashboard" element={<MainDashboard />} />
          <Route path="/analysis-workspace" element={<AnalysisWorkspace />} />
          <Route path="/results-visualization" element={<ResultsVisualization />} />
        </Routes>
      </main>
    </ErrorBoundary>
  );
}

export default App;
