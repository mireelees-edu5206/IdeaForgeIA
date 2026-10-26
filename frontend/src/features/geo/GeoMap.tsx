import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { GeoBusiness, GeoPlace } from "./types";

const DEFAULT_VIEW: [number, number] = [19.2925, -99.6569];
const DEFAULT_ZOOM = 12;

interface GeoMapProps {
  center: GeoPlace | null;
  places: GeoBusiness[];
  radiusM: number;
  onSelectLocation?: (latitude: number, longitude: number) => void;
}

export function GeoMap({ center, places, radiusM, onSelectLocation }: GeoMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const radiusCircle = useRef<L.Circle | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;

  useEffect(() => {
    if (!container.current || map.current) return;
    const initialLat = center ? Number(center.latitude) : DEFAULT_VIEW[0];
    const initialLng = center ? Number(center.longitude) : DEFAULT_VIEW[1];
    const instance = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      preferCanvas: true,
    }).setView([initialLat, initialLng], center ? 14 : DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      keepBuffer: 1,
      updateWhenIdle: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(instance);
    L.control.zoom({ position: "bottomright" }).addTo(instance);

    instance.on("click", (event: L.LeafletMouseEvent) => {
      onSelectRef.current?.(event.latlng.lat, event.latlng.lng);
    });

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
  }, []);

  useEffect(() => {
    const instance = map.current;
    const layer = markers.current;
    if (!instance || !layer) return;

    layer.clearLayers();
    radiusCircle.current?.removeFrom(instance);
    radiusCircle.current = null;

    if (!center) return;
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    try {
      instance.setView([lat, lng], Math.max(instance.getZoom(), 14), { animate: false });
      radiusCircle.current = L.circle([lat, lng], {
        radius: radiusM,
        color: "#a855f7",
        fillColor: "#c084fc",
        fillOpacity: 0.08,
        weight: 1.5,
      }).addTo(instance);

      const centerMarker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#7c3aed;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:grab;"></span>',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      })
        .bindPopup(popupForLocation(center.display_name))
        .addTo(layer);

      centerMarker.on("dragend", () => {
        const pos = centerMarker.getLatLng();
        onSelectRef.current?.(pos.lat, pos.lng);
      });

      for (const place of places) {
        const pLat = Number(place.latitude);
        const pLng = Number(place.longitude);
        if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) continue;
        L.circleMarker([pLat, pLng], {
          radius: 6,
          color: "#fff",
          weight: 1.5,
          fillColor: "#d946ef",
          fillOpacity: 0.95,
        })
          .bindPopup(popupForBusiness(place))
          .addTo(layer);
      }

      const bounds = radiusCircle.current.getBounds();
      if (bounds.isValid()) {
        instance.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 15,
        });
      }
    } catch {
      // Si el contenedor está en transición de tamaño, conservamos la vista base centrada.
    }
  }, [center, places, radiusM]);

  return (
    <div
      ref={container}
      className="geo-map h-72 w-full cursor-crosshair overflow-hidden rounded-2xl border border-slate-400/20 sm:h-[25rem]"
      role="region"
      aria-label={
        center
          ? `Mapa de OpenStreetMap centrado en ${center.display_name}`
          : "Mapa interactivo de OpenStreetMap: haz clic para elegir una zona"
      }
    />
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
