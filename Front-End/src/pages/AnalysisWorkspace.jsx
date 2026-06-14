import React from "react";
import DrawMap from "../components/DrawMap";

const AnalysisWorkspace = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Analysis Workspace</h1>
        <DrawMap />
      </div>
    </div>
  );
};

export default AnalysisWorkspace;
