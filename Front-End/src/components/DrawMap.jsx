import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Draw, { createBox } from 'ol/interaction/Draw';

const DrawMap = ({ onCoordinatesExtracted }) => {
  const mapElement = useRef();
  const [map, setMap] = useState(null);
  const [drawnExtent, setDrawnExtent] = useState(null);

  useEffect(() => {
    // 1. Create a layer to hold the drawn shape
    const source = new VectorSource({ wrapX: false });
    const vector = new VectorLayer({
      source: source,
    });

    // 2. Initialize the OpenLayers Map
    const initialMap = new Map({
      target: mapElement.current,
      layers: [
        new TileLayer({
          source: new OSM(), // Standard OpenStreetMap base layer
        }),
        vector, // Add the vector layer so drawings are visible
      ],
      view: new View({
        center: [0, 0], // Longitude, Latitude (Will start centered on the world)
        zoom: 2,
      }),
    });

    // 3. Create the Drawing Interaction (Square/Box)
    // OpenLayers uses 'Circle' + createBox() to draw rectangles
    const drawInteraction = new Draw({
      source: source,
      type: 'Circle',
      geometryFunction: createBox(),
    });

    // 4. Listen for when the user finishes drawing
    drawInteraction.on('drawend', (event) => {
      // Clear previous drawings so we only have one box at a time
      source.clear();
      
      const feature = event.feature;
      const geometry = feature.getGeometry();
      
      // Get the Bounding Box coordinates [minX, minY, maxX, maxY]
      const extent = geometry.getExtent(); 
      
      setDrawnExtent(extent);
      if (onCoordinatesExtracted) {
        onCoordinatesExtracted(extent);
      }
    });

    initialMap.addInteraction(drawInteraction);
    setMap(initialMap);

    // Cleanup on unmount
    return () => {
      initialMap.setTarget(null);
    };
  }, [onCoordinatesExtracted]);

  // Function to send data to your backend
  const sendToBackend = async () => {
    if (!drawnExtent) return;

    try {
      // NOTE: Replace 'http://localhost:5000/api/process-bbox' with your actual Python backend URL
      /*
      const response = await fetch('http://localhost:5000/api/process-bbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bbox: drawnExtent 
        })
      });
      const data = await response.json();
      console.log("Backend response:", data);
      */
      
      alert(`Coordinates successfully extracted!\nMinX: ${drawnExtent[0]}\nMinY: ${drawnExtent[1]}\nMaxX: ${drawnExtent[2]}\nMaxY: ${drawnExtent[3]}\n\n(Check the code to uncomment the fetch request to your backend)`);
    } catch (error) {
      console.error("Error sending to backend:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">Select Region for Analysis</h2>
        <p className="text-gray-500">Click and drag on the map to draw a square over your coastal area.</p>
      </div>

      {/* Map Container */}
      <div 
        ref={mapElement} 
        className="w-full h-[500px] border-4 border-blue-100 rounded-xl overflow-hidden shadow-lg"
      ></div>
      
      {/* Coordinates Display & Backend Submit Button */}
      {drawnExtent && (
        <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100 flex justify-between items-center animate-in fade-in slide-in-from-bottom-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Selected Coordinates:</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-gray-600 font-mono">
              <p><span className="font-semibold text-gray-800">Min X:</span> {drawnExtent[0].toFixed(2)}</p>
              <p><span className="font-semibold text-gray-800">Max X:</span> {drawnExtent[2].toFixed(2)}</p>
              <p><span className="font-semibold text-gray-800">Min Y:</span> {drawnExtent[1].toFixed(2)}</p>
              <p><span className="font-semibold text-gray-800">Max Y:</span> {drawnExtent[3].toFixed(2)}</p>
            </div>
          </div>
          
          <button 
            onClick={sendToBackend}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
          >
            Extract & Send to Backend
          </button>
        </div>
      )}
    </div>
  );
};

export default DrawMap;
