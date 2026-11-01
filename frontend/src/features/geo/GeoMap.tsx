/**
 * ARCHIVO: geo/GeoMap.tsx
 *
 * ¿Qué es?
 * Es el mapa interactivo con el que se elige una zona y se ven los negocios encontrados. Usa
 * Leaflet, una librería que dibuja mapas, y las teselas (imágenes del mapa) de OpenStreetMap.
 *
 * ¿Para qué sirve?
 * Para ver de un vistazo dónde está la zona, cuál es su radio de búsqueda, y dónde están los
 * negocios. También permite tocar el mapa para elegir otro punto, o arrastrar el marcador violeta.
 *
 * ¿Quién lo usa?
 * GeoExplorer.tsx (en la pestaña de competidores) y AdminLabPage.tsx (en el laboratorio).
 *
 * Qué se ve:
 * - Un marcador violeta en el centro elegido, con un círculo que muestra el radio.
 * - Puntos fucsia para cada negocio. Al tocar uno, se abre un globo con su nombre y su enlace.
 * - Botones de zoom abajo a la derecha.
 *
 * Cambios comunes que puedes hacer aquí:
 * - Colores del círculo y del marcador: en el objeto de L.circle (color, fillColor) y en el HTML del
 *   marcador (background y border).
 * - Vista inicial sin zona: cambia DEFAULT_VIEW (latitud y longitud) y DEFAULT_ZOOM.
 * - Tamaño del mapa: cambia las clases del div final (h-72 y sm:h-[25rem]).
 */

/* "useEffect" hace algo cuando cambian datos. "useRef" guarda referencias que no provocan redibujos. */
import { useEffect, useRef } from "react";
/* La librería que dibuja el mapa. */
import L from "leaflet";
/* Estilos de Leaflet (botones, globos y capas). Sin este archivo, el mapa se ve roto. */
import "leaflet/dist/leaflet.css";

/* Tipos de ubicación y de negocio. */
import type { GeoBusiness, GeoPlace } from "./types";

/**
 * DEFAULT_VIEW es el punto donde se centra el mapa cuando no hay zona elegida: [latitud, longitud].
 * Aquí está Toluca, en el Estado de México. Cambia estos números para empezar en otra ciudad.
 */
/** Define DEFAULT_VIEW para el bloque de mapa y zonas. */
const DEFAULT_VIEW: [number, number] = [19.2925, -99.6569];
/**
 * DEFAULT_ZOOM es qué tan cerca se ve el mapa al inicio, sin zona elegida. Entre más alto, más cerca.
 * 12 muestra una ciudad completa.
 */
/** Define DEFAULT_ZOOM para el bloque de mapa y zonas. */
const DEFAULT_ZOOM = 12;

/**
 * GeoMapProps describe lo que recibe el mapa:
 * - center: la zona elegida, o null si todavía no hay ninguna.
 * - places: la lista de negocios a dibujar.
 * - radiusM: el radio del círculo, en metros.
 * - onSelectLocation (opcional): función que se llama con latitud y longitud cuando la persona
 *   toca el mapa o arrastra el marcador. El "?" significa que puede faltar.
 */
/** Contrato de datos GeoMapProps utilizado por mapa y zonas. */
interface GeoMapProps {
  center: GeoPlace | null;
  places: GeoBusiness[];
  radiusM: number;
  onSelectLocation?: (latitude: number, longitude: number) => void;
}

/**
 * GeoMap dibuja el mapa. Lo hace en dos momentos:
 * 1. Una sola vez, al aparecer: crea el mapa, la capa de teselas, el zoom y el clic para elegir punto.
 * 2. Cada vez que cambian el centro, los negocios o el radio: borra lo anterior y dibuja de nuevo.
 */
/** Expone la funcion geo map para el flujo de geo. */
export function GeoMap({ center, places, radiusM, onSelectLocation }: GeoMapProps) {
  // "container" apunta al div donde se dibuja el mapa.
  const container = useRef<HTMLDivElement>(null);
  // "map" guarda el mapa creado, para no crearlo dos veces.
  const map = useRef<L.Map | null>(null);
  // "markers" es una capa que agrupa el marcador central y los negocios, para borrarlos juntos.
  const markers = useRef<L.LayerGroup | null>(null);
  // "radiusCircle" es el círculo que muestra el radio de búsqueda.
  const radiusCircle = useRef<L.Circle | null>(null);
  // "onSelectRef" guarda siempre la función más reciente. Así los eventos del mapa no usan una función vieja.
  const onSelectRef = useRef(onSelectLocation);
  onSelectRef.current = onSelectLocation;

  // Primer efecto: crea el mapa una sola vez.
  useEffect(() => {
    // Si el contenedor no existe o el mapa ya está creado, no hacemos nada.
    /** Rama condicional: !container.current || map.current. */
    if (!container.current || map.current) return;
    // Si ya hay una zona, el mapa arranca centrado ahí; si no, en la vista por defecto.
    // "Number(...)" convierte el valor a número por seguridad.
    const initialLat = center ? Number(center.latitude) : DEFAULT_VIEW[0];
    const initialLng = center ? Number(center.longitude) : DEFAULT_VIEW[1];
    // Creamos el mapa. "zoomControl: false" oculta los botones de zoom por defecto (los agregamos abajo).
    // "preferCanvas" dibuja los puntos con canvas, que es más rápido con muchos negocios.
    const instance = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      preferCanvas: true,
    }).setView([initialLat, initialLng], center ? 14 : DEFAULT_ZOOM);

    // La capa de imágenes del mapa, desde los servidores de OpenStreetMap.
    // "{s}", "{z}", "{x}" y "{y}" son huecos que Leaflet llena con cada pedazo de mapa que necesita.
    // "keepBuffer" guarda un anillo de teselas alrededor para que el movimiento se vea suave.
    // "updateWhenIdle" espera a que termines de mover el mapa antes de cargar nuevas imágenes.
    // El "attribution" es el texto de crédito que OpenStreetMap exige mostrar.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      keepBuffer: 1,
      updateWhenIdle: true,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(instance);
    // Los botones de zoom, abajo a la derecha.
    L.control.zoom({ position: "bottomright" }).addTo(instance);

    // Cuando la persona toca el mapa, mandamos la latitud y longitud del punto tocado.
    instance.on("click", (event: L.LeafletMouseEvent) => {
      onSelectRef.current?.(event.latlng.lat, event.latlng.lng);
    });

    // Guardamos el mapa y creamos la capa donde irán los marcadores.
    map.current = instance;
    markers.current = L.layerGroup().addTo(instance);

    // Al terminar de pintarse, pedimos al mapa que recalcule su tamaño (evita un mapa a medias).
    const frame = window.requestAnimationFrame(() => instance.invalidateSize());
    // Limpieza: al salir de la pantalla, quitamos el mapa y soltamos las referencias.
    return () => {
      window.cancelAnimationFrame(frame);
      instance.remove();
      map.current = null;
      markers.current = null;
      radiusCircle.current = null;
    };
  }, []);

  // Segundo efecto: se vuelve a ejecutar cada vez que cambian el centro, los negocios o el radio.
  useEffect(() => {
    const instance = map.current;
    const layer = markers.current;
    // Si el mapa todavía no existe, no hay nada que dibujar.
    /** Rama condicional: !instance || !layer. */
    if (!instance || !layer) return;

    // Borramos los marcadores y el círculo de la vez anterior.
    layer.clearLayers();
    radiusCircle.current?.removeFrom(instance);
    radiusCircle.current = null;

    // Sin zona elegida, no dibujamos nada más.
    /** Rama condicional: !center. */
    if (!center) return;
    // Convertimos el centro a números y revisamos que sean valores válidos.
    const lat = Number(center.latitude);
    const lng = Number(center.longitude);
    /** Rama condicional: !Number.isFinite(lat) || !Number.isFinite(lng). */
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // El bloque "try" evita que un error de dibujo rompa toda la pantalla.
    /** Maneja fallos de la operacion del bloque mapa y zonas. */
    try {
      // Centramos el mapa en la zona. "Math.max" nunca lo aleja menos de zoom 14.
      instance.setView([lat, lng], Math.max(instance.getZoom(), 14), { animate: false });
      // El círculo del radio: morado, con relleno muy transparente (0.08).
      radiusCircle.current = L.circle([lat, lng], {
        radius: radiusM,
        color: "#a855f7",
        fillColor: "#c084fc",
        fillOpacity: 0.08,
        weight: 1.5,
      }).addTo(instance);

      // El marcador central: un punto violeta que se puede arrastrar. Su aspecto está en el HTML de divIcon.
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

      // Si la persona suelta el marcador en otro punto, avisamos con la nueva posición.
      centerMarker.on("dragend", () => {
        const pos = centerMarker.getLatLng();
        onSelectRef.current?.(pos.lat, pos.lng);
      });

      // Un punto fucsia por cada negocio. Si un negocio no tiene coordenadas válidas, lo saltamos.
      /** Recorre los elementos del bloque mapa y zonas. */
      for (const place of places) {
        const pLat = Number(place.latitude);
        const pLng = Number(place.longitude);
        /** Rama condicional: !Number.isFinite(pLat) || !Number.isFinite(pLng). */
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

      // Ajustamos el zoom para que se vea completo el círculo. "maxZoom: 15" evita acercarse demasiado.
      const bounds = radiusCircle.current.getBounds();
      /** Rama condicional: bounds.isValid(). */
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
    // El contenedor del mapa. Su altura depende de la pantalla (h-72 en celular, 25rem en pantallas grandes).
    // "role" y "aria-label" lo describen para lectores de pantalla, con el nombre de la zona si ya hay una.
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

/**
 * popupForLocation crea el texto del globo del marcador central: solo el nombre de la zona.
 * Se arma con elementos del DOM y "textContent", en lugar de HTML, para que el nombre nunca se
 * interprete como código.
 */
/** Gestiona popup for location de mapa y zonas. */
function popupForLocation(name: string): HTMLElement {
  const content = document.createElement("strong");
  content.textContent = name;
  return content;
}

/**
 * popupForBusiness crea el globo de un negocio: su nombre, su categoría y un enlace a su ficha en
 * OpenStreetMap que se abre en pestaña nueva. Igual que arriba, se usa "textContent" por seguridad.
 */
/** Gestiona popup for business de mapa y zonas. */
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
