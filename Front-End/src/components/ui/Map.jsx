// src/components/ui/Map.jsx
import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { transform } from "ol/proj";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import Draw, { createBox } from "ol/interaction/Draw";
import { Modify, Snap } from "ol/interaction";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { fromLonLat } from "ol/proj";
import { Trash2, Edit2, Save, ZoomIn, ZoomOut } from "lucide-react";

const Map = ({ onCoordinatesReady, shorelineData }) => {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const shorelineSourceRef = useRef(null);
  const drawRef = useRef(null);
  const modifyRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const satelliteLayer = new TileLayer({
      source: new XYZ({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      }),
    });

    const labelsLayer = new TileLayer({
      source: new XYZ({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      }),
    });

    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        fill: new Fill({ color: "rgba(71, 166, 255, 0.18)" }),
        stroke: new Stroke({ color: "rgba(71, 166, 255, 1)", width: 2 }),
        image: new CircleStyle({ radius: 5, fill: new Fill({ color: "#09f" }) }),
      }),
    });

    const shorelineSource = new VectorSource();
    shorelineSourceRef.current = shorelineSource;

    const shorelineLayer = new VectorLayer({
      source: shorelineSource,
      style: new Style({
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color: "#ff4d4d" }), // Red color for predicted points
          stroke: new Stroke({ color: "#fff", width: 1 }),
        }),
      }),
    });

    const map = new OlMap({
      target: mapElementRef.current,
      layers: [satelliteLayer, labelsLayer, vectorLayer, shorelineLayer],
      view: new View({
        center: fromLonLat([80.6480, 16.5062]), // Vijayawada
        zoom: 12,
      }),
      controls: [],
    });

    drawRef.current = new Draw({ 
      source: vectorSource,
      type: "Circle",
      geometryFunction: createBox()
    });
    
    // Clear any previous drawings when you start drawing a new one
    drawRef.current.on('drawstart', () => {
      vectorSourceRef.current.clear();
    });

    // When drawing is complete, extract and send coordinates to parent
    drawRef.current.on('drawend', (event) => {
      const extent = event.feature.getGeometry().getExtent();
      const minLonLat = transform([extent[0], extent[1]], "EPSG:3857", "EPSG:4326");
      const maxLonLat = transform([extent[2], extent[3]], "EPSG:3857", "EPSG:4326");

      if (minLonLat[0] !== maxLonLat[0] && minLonLat[1] !== maxLonLat[1]) {
        const polygonCoordinates = [[
          [minLonLat[0], minLonLat[1]],
          [minLonLat[0], maxLonLat[1]],
          [maxLonLat[0], maxLonLat[1]],
          [maxLonLat[0], minLonLat[1]],
          [minLonLat[0], minLonLat[1]]
        ]];
        if (onCoordinatesReady) onCoordinatesReady(polygonCoordinates);
      }
    });

    drawRef.current.setActive(false);
    map.addInteraction(drawRef.current);

    modifyRef.current = new Modify({ source: vectorSource });
    modifyRef.current.setActive(false);
    map.addInteraction(modifyRef.current);

    map.addInteraction(new Snap({ source: vectorSource }));

    mapRef.current = map;

    return () => {
      map.setTarget(null);
    };
  }, []);

  // Update shoreline data when it changes
  useEffect(() => {
    if (shorelineData && shorelineSourceRef.current) {
      shorelineSourceRef.current.clear();
      const features = new GeoJSON().readFeatures(shorelineData, {
        featureProjection: "EPSG:3857",
      });
      shorelineSourceRef.current.addFeatures(features);

      // Fit map to shoreline data
      if (features.length > 0) {
        const extent = shorelineSourceRef.current.getExtent();
        mapRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
      }
    }
  }, [shorelineData]);

  const toggleDrawing = () => {
    modifyRef.current.setActive(false);
    const newState = !drawRef.current.getActive();
    drawRef.current.setActive(newState);
    setIsDrawing(newState);
    setIsEditing(false);
  };

  const toggleEditing = () => {
    drawRef.current.setActive(false);
    const newState = !modifyRef.current.getActive();
    modifyRef.current.setActive(newState);
    setIsEditing(newState);
    setIsDrawing(false);
  };

  const clearPolygons = () => {
    vectorSourceRef.current?.clear();
    shorelineSourceRef.current?.clear();
  };

  const zoomIn = () => mapRef.current?.getView().setZoom(mapRef.current.getView().getZoom() + 1);
  const zoomOut = () => mapRef.current?.getView().setZoom(mapRef.current.getView().getZoom() - 1);

  return (
    <div className="relative w-full h-[calc(100vh-64px)]">
      <div
        className="absolute top-4 left-4 z-20 flex flex-col gap-3 p-3 rounded-xl shadow-lg"
        style={{
          backdropFilter: "blur(8px)",
          background: "rgba(255,255,255,0.2)",
        }}
      >
        <button onClick={zoomIn}><ZoomIn /></button>
        <button onClick={zoomOut}><ZoomOut /></button>
        <button onClick={toggleDrawing}><Edit2 color={isDrawing ? "blue" : "black"} /></button>
        <button onClick={toggleEditing}><Save color={isEditing ? "blue" : "black"} /></button>
        <button onClick={clearPolygons}><Trash2 color="red" /></button>
      </div>
      <div ref={mapElementRef} className="w-full h-full rounded-lg shadow-lg" />
    </div>
  );
};

export default Map;
