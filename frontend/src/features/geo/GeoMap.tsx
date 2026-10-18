import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { GeoBusiness, GeoPlace } from "./types";

interface GeoMapProps {
  center: GeoPlace | null;
  places: GeoBusiness[];
  radiusM: number;
}

export function GeoMap({ center, places, radiusM }: GeoMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const radiusCircle = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!center || !container.current) return;
    const instance = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      keepBuffer: 1,
      updateWhenIdle: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(instance);
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    map.current = instance;
    markers.current = L.layerGroup().addTo(instance);

    const frame = window.requestAnimationFrame(() => instance.invalidateSize());
    return () => {
      window.cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      markers.current = null;
      radiusCircle.current = null;
    };
  }, [center?.latitude, center?.longitude]);

  useEffect(() => {
    const instance = map.current;
    const layer = markers.current;
    if (!center || !instance || !layer) return;

    layer.clearLayers();
    radiusCircle.current?.removeFrom(instance);
    radiusCircle.current = L.circle([center.latitude, center.longitude], {
      radius: radiusM,
      color: "#a855f7",
      fillColor: "#c084fc",
      fillOpacity: 0.08,
      weight: 1.5,
    }).addTo(instance);
    L.circleMarker([center.latitude, center.longitude], {
      radius: 7,
      color: "#fff",
      weight: 2,
      fillColor: "#7c3aed",
      fillOpacity: 1,
    })
      .bindPopup(popupForLocation(center.display_name))
      .addTo(layer);

    for (const place of places) {
      L.circleMarker([place.latitude, place.longitude], {
        radius: 6,
        color: "#fff",
        weight: 1.5,
        fillColor: "#d946ef",
        fillOpacity: 0.95,
      })
        .bindPopup(popupForBusiness(place))
        .addTo(layer);
    }

    instance.fitBounds(radiusCircle.current.getBounds(), {
      padding: [20, 20],
      maxZoom: 15,
    });
  }, [center, places, radiusM]);

  return center ? (
    <div
      ref={container}
      className="geo-map h-72 w-full overflow-hidden rounded-2xl border border-slate-400/20 sm:h-[25rem]"
      role="region"
      aria-label={`Mapa de OpenStreetMap centrado en ${center.display_name}`}
    />
  ) : (
    <div className="neo-inset flex h-72 items-center justify-center rounded-2xl px-6 text-center text-sm text-slate-400 sm:h-[25rem]">
      Busca una localidad o comparte tu ubicación para mostrar el mapa.
    </div>
  );
}

function popupForLocation(name: string): HTMLElement {
  const content = document.createElement("strong");
  content.textContent = name;
  return content;
}

function popupForBusiness(place: GeoBusiness): HTMLElement {
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = place.name;
  const category = document.createElement("p");
  category.textContent = place.subtype ?? place.category;
  const link = document.createElement("a");
  link.href = place.osm_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer nofollow";
  link.textContent = "Ver ficha en OpenStreetMap";
  content.append(title, category, link);
  return content;
}
