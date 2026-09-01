// src/components/ui/Map.jsx
import React, { useEffect, useRef, useState } from "react";
import "ol/ol.css";
import { transform } from "ol/proj";
import { Map as OlMap, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import Translate from "ol/interaction/Translate";
import Draw, { createBox, createRegularPolygon } from "ol/interaction/Draw";
import { Snap } from "ol/interaction";
import Collection from "ol/Collection";
import GeoJSON from "ol/format/GeoJSON";
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style";
import { fromLonLat } from "ol/proj";
import { getArea } from "ol/sphere";
import { Trash2, Edit2, Move, ZoomIn, ZoomOut, Square, Maximize } from "lucide-react";

const Map = ({ onCoordinatesReady, shorelineData, erosionGeoJSON, transectsData }) => {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const shorelineSourceRef = useRef(null);
  const erosionSourceRef = useRef(null);
  const transectsSourceRef = useRef(null);
  const drawRef = useRef(null);
  const modifyRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [drawMode, setDrawMode] = useState("rectangle"); // "square", "rectangle", "polygon"
  const drawModeRef = useRef(drawMode);

  useEffect(() => {
    drawModeRef.current = drawMode;
    if (mapRef.current && drawRef.current) {
      // Recreate draw interaction when mode changes to update the 'type'
      const isActive = drawRef.current.getActive();
      mapRef.current.removeInteraction(drawRef.current);
      if (window.createDrawInteraction) {
        window.createDrawInteraction();
      }
      drawRef.current.setActive(isActive);
    }
  }, [drawMode]);

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

    const editFeatures = new Collection();
    const vectorSource = new VectorSource({ features: editFeatures });
    vectorSourceRef.current = vectorSource;

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: [
        // Outer Glow / Shadow
        new Style({
          stroke: new Stroke({ color: "rgba(59, 130, 246, 0.4)", width: 10 }),
        }),
        // Inner Glow
        new Style({
          stroke: new Stroke({ color: "rgba(56, 189, 248, 0.6)", width: 6 }),
        }),
        // Core Line & Fill
        new Style({
          fill: new Fill({ color: "rgba(15, 23, 42, 0.4)" }), // Dark glass effect
          stroke: new Stroke({ color: "rgba(255, 255, 255, 0.9)", width: 2 }),
          image: new CircleStyle({ 
            radius: 7, 
            fill: new Fill({ color: "#fff" }),
            stroke: new Stroke({ color: "#3b82f6", width: 2 })
          }),
        })
      ],
    });

    const shorelineSource = new VectorSource();
    shorelineSourceRef.current = shorelineSource;

    const shorelineLayer = new VectorLayer({
      source: shorelineSource,
      style: new Style({
        stroke: new Stroke({ color: "#ff4d4d", width: 2 }), // For LineString
        image: new CircleStyle({
          radius: 4,
          fill: new Fill({ color: "#ff4d4d" }), // Red color for predicted points
          stroke: new Stroke({ color: "#fff", width: 1 }),
        }),
      }),
    });

    const erosionSource = new VectorSource();
    erosionSourceRef.current = erosionSource;

    const erosionLayer = new VectorLayer({
      source: erosionSourceRef.current,
      style: (feature) => {
        const type = feature.get('type');
        if (type === 'erosion') {
          return new Style({
            stroke: new Stroke({ color: "#ef4444", width: 4, lineDash: [4, 6] }), // Red dotted line for erosion
          });
        } else if (type === 'accretion') {
          return new Style({
            stroke: new Stroke({ color: "#10b981", width: 4 }), // Green solid line for accretion
          });
        }
      },
      zIndex: 6,
    });

    const transectsSource = new VectorSource();
    transectsSourceRef.current = transectsSource;

    const transectsLayer = new VectorLayer({
      source: transectsSource,
      style: new Style({
        stroke: new Stroke({ color: "#facc15", width: 2, lineDash: [4, 4] }), // Yellow dashed line
      }),
    });

    const map = new OlMap({
      target: mapElementRef.current,
      layers: [satelliteLayer, labelsLayer, vectorLayer, shorelineLayer, erosionLayer, transectsLayer],
      view: new View({
        center: fromLonLat([80.6480, 16.5062]), // Vijayawada
        zoom: 12,
      }),
      controls: [],
    });
    mapRef.current = map;



    window.createDrawInteraction = () => {
      if (drawRef.current && mapRef.current) {
        mapRef.current.removeInteraction(drawRef.current);
      }
      
      const customRotatedRect = function (coordinates, geometry) {
        if (!geometry) {
          geometry = new Polygon([]);
        }
        const start = coordinates[0];
        const end = coordinates[1];
        
        // Calculate angle and raw distance
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        let distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Automatically constrain the box size to a safe maximum (~30km in Web Mercator)
        // This prevents the Google Earth Engine download from crashing due to file size limits.
        const MAX_DISTANCE = 30000;
        if (distance > MAX_DISTANCE) {
          distance = MAX_DISTANCE;
        }

        // Set rectangle dimensions (width = distance, height = distance / 2)
        const width = distance;
        const height = distance * 0.25; // Adjusted to be 1/4 of width for a 4:1 aspect ratio
        
        const points = [
          [width, height],
          [width, -height],
          [-width, -height],
          [-width, height],
          [width, height]
        ];
        
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const rotatedPoints = points.map(p => [
          center[0] + (p[0] * cos - p[1] * sin),
          center[1] + (p[0] * sin + p[1] * cos)
        ]);
        
        geometry.setCoordinates([rotatedPoints]);
        return geometry;
      };

      const boxFn = createBox();

      drawRef.current = new Draw({ 
        source: vectorSourceRef.current,
        type: drawModeRef.current === 'polygon' ? 'Polygon' : 'Circle',
        geometryFunction: drawModeRef.current === 'polygon' ? undefined : function(coordinates, geometry) {
          if (drawModeRef.current === 'square') {
            return customRotatedRect(coordinates, geometry);
          } else {
            return boxFn(coordinates, geometry);
          }
        },
        style: [
          new Style({ stroke: new Stroke({ color: "rgba(56, 189, 248, 0.4)", width: 8 }) }),
          new Style({
            fill: new Fill({ color: "rgba(15, 23, 42, 0.2)" }),
            stroke: new Stroke({ color: "rgba(255, 255, 255, 0.8)", width: 2, lineDash: [5, 5] }),
            image: new CircleStyle({ radius: 6, fill: new Fill({ color: "#38bdf8" }) })
          })
        ]
      });
      
      drawRef.current.on('drawstart', () => {
        vectorSourceRef.current.clear();
      });

      drawRef.current.on('drawend', (event) => {
        const feature = event.feature;
        const geom = feature.getGeometry();
        
        const geom4326 = geom.clone().transform("EPSG:3857", "EPSG:4326");
        const areaSqMeters = getArea(geom4326);
        const maxAreaSqMeters = 100_000_000; 

        if (areaSqMeters > maxAreaSqMeters) {
          alert(`The drawn area is too large for the AI model! \n\nYou drew ~${(areaSqMeters / 1_000_000).toFixed(2)} sq km. \nThe maximum allowed is 100 sq km. \n\nPlease draw a smaller shape.`);
          setTimeout(() => vectorSourceRef.current.clear(), 10);
          if (onCoordinatesReady) onCoordinatesReady(null);
          return;
        }

        const polygonCoordinates = geom4326.getCoordinates();
        if (onCoordinatesReady && polygonCoordinates.length > 0) {
          onCoordinatesReady(polygonCoordinates);
        }

        setTimeout(() => {
          if (modifyRef.current && !modifyRef.current.getActive()) {
            toggleEditing();
          }
        }, 50);
      });

      drawRef.current.setActive(isDrawing);
      if (mapRef.current) mapRef.current.addInteraction(drawRef.current);
    };

    window.createDrawInteraction();

    modifyRef.current = new Translate({ features: editFeatures });
    
    modifyRef.current.on('translateend', (event) => {
      const features = event.features;
      if (features && features.getLength() > 0) {
        const feature = features.item(0);
        const geom = feature.getGeometry();
        
        const geom4326 = geom.clone().transform("EPSG:3857", "EPSG:4326");
        const polygonCoordinates = geom4326.getCoordinates();
        
        if (onCoordinatesReady && polygonCoordinates.length > 0) {
          onCoordinatesReady(polygonCoordinates);
        }
      }
    });

    modifyRef.current.setActive(false);
    map.addInteraction(modifyRef.current);

    return () => {
      if (mapRef.current) mapRef.current.setTarget(null);
      delete window.createDrawInteraction;
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

  // Update transects data when it changes
  useEffect(() => {
    if (transectsData && transectsData.type === "FeatureCollection" && transectsSourceRef.current) {
      transectsSourceRef.current.clear();
      try {
        const features = new GeoJSON().readFeatures(transectsData, {
          featureProjection: "EPSG:3857",
        });
        transectsSourceRef.current.addFeatures(features);

        if (features.length > 0) {
          const extent = transectsSourceRef.current.getExtent();
          mapRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
        }
      } catch (err) {
        console.error("Failed to render transects:", err);
      }
    }
  }, [transectsData]);

  // Update erosion data when it changes
  useEffect(() => {
    if (erosionGeoJSON && erosionSourceRef.current) {
      erosionSourceRef.current.clear();
      const features = new GeoJSON().readFeatures(erosionGeoJSON, {
        featureProjection: "EPSG:3857",
      });
      erosionSourceRef.current.addFeatures(features);

      if (features.length > 0) {
        const extent = erosionSourceRef.current.getExtent();
        mapRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000 });
      }
    }
  }, [erosionGeoJSON]);

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
        <button onClick={zoomIn} title="Zoom In"><ZoomIn /></button>
        <button onClick={zoomOut} title="Zoom Out"><ZoomOut /></button>
        <button onClick={toggleDrawing} title="Draw AOI">
          <Edit2 color={isDrawing ? "blue" : "black"} />
        </button>
        <button 
          onClick={() => {
            setDrawMode(prev => prev === 'rectangle' ? 'square' : prev === 'square' ? 'polygon' : 'rectangle');
          }} 
          title={`Toggle Mode (Current: ${drawMode})`}
        >
          {drawMode === 'square' && <Square color="purple" />}
          {drawMode === 'rectangle' && <Maximize color="purple" />}
          {drawMode === 'polygon' && <Edit2 color="purple" />}
        </button>
        <button onClick={toggleEditing} title="Move AOI">
          <Move color={isEditing ? "blue" : "black"} />
        </button>
        <button onClick={clearPolygons} title="Clear Map"><Trash2 color="red" /></button>
      </div>
      <div ref={mapElementRef} className="w-full h-full rounded-lg shadow-lg" />
    </div>
  );
};

export default Map;
