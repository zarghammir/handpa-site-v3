import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

if (!mapboxgl.accessToken) {
  console.error("Missing VITE_MAPBOX_TOKEN");
}
function createGeoJSONCircle(center, radiusInKm, points = 64) {
  const coords = {
    latitude: center[1],
    longitude: center[0],
  };

  const km = radiusInKm;
  const ret = [];
  const distanceX =
    km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);

    ret.push([coords.longitude + x, coords.latitude + y]);
  }

  ret.push(ret[0]);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ret],
        },
        properties: {},
      },
    ],
  };
}

export default function LessonMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const carderoArea = [-123.1349, 49.28795];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: carderoArea,
      zoom: 13,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("lesson-area", {
        type: "geojson",
        data: createGeoJSONCircle(carderoArea, 0.7), // radius in km
      });

      map.addLayer({
        id: "lesson-area-fill",
        type: "fill",
        source: "lesson-area",
        paint: {
          "fill-color": "#E67E22",
          "fill-opacity": 0.14,
        },
      });

      map.addLayer({
        id: "lesson-area-outline",
        type: "line",
        source: "lesson-area",
        paint: {
          "line-color": "#E67E22",
          "line-width": 3,
          "line-opacity": 0.5,
        },
      });

      map.resize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <section className="bg-white px-4 py-12 sm:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center md:mb-10">
          <div className="mb-4 flex justify-center">
            <span className="inline-block rounded-full bg-forest px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-cream">
              Lesson Area
            </span>
          </div>

          <h2 className="mb-3 text-3xl font-black leading-tight text-forest sm:text-4xl md:text-5xl">
            Downtown Vancouver,{" "}
            <span className="text-sage">Cardero St area</span>
          </h2>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-forest/60 md:text-lg">
            Serving students in a calm, central location with easy access and a relaxed in-person learning experience.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-black/10 shadow-lg ring-2 ring-sage/20">
          <div
            ref={mapContainer}
            className="w-full h-[240px] sm:h-[300px] md:h-[380px] lg:h-[460px]"
          />
        </div>
      </div>
    </section>
  );
}