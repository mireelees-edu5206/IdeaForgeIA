/**
 * ARCHIVO: geo/GeoExplorer.tsx
 *
 * ¿Qué es?
 * Es el panel de exploración geográfica que aparece en la pestaña "Otras opciones del mercado"
 * (competidores). Permite buscar una zona por nombre, usar la ubicación del dispositivo o tocar el
 * mapa, y luego buscar qué negocios de un giro hay alrededor en OpenStreetMap.
 *
 * ¿Para qué sirve?
 * Para descubrir alternativas que ya existen en un área (por ejemplo, cuántas heladerías hay en
 * 1 km). Es una pista para investigar, no una prueba: el mapa solo muestra lo que está registrado.
 *
 * ¿Quién lo usa?
 * CompetitorsTab.tsx (dentro de la pestaña de competidores del proyecto).
 *
 * Flujo que sigue la persona:
 * 1. Busca una zona por nombre, o usa su ubicación, o toca el mapa para elegir un punto.
 * 2. Escribe el tipo de negocio y el radio, y pulsa "Explorar alrededores".
 * 3. Ve la lista de lugares y el mapa con sus puntos.
 * 4. Opcional: "Usar esta zona en el veredicto" lleva esos datos a la pestaña de veredicto.
 *
 * Reglas importantes:
 * - Cada búsqueda se manda solo cuando la persona la pide. No hay búsqueda automática mientras escribe.
 * - Buscar una zona necesita al menos 3 letras. El tipo de negocio necesita al menos 2 letras.
 * - Si no aparecen lugares, la pantalla avisa que eso no demuestra que no existan negocios.
 */

/* "useState" guarda la búsqueda, la zona elegida, los errores y si se está localizando. */
import { type FormEvent, useState } from "react";
/* Iconos: punto de mira (usar mi ubicación), pin de mapa y lupa. */
import { FiCrosshair, FiMapPin, FiSearch } from "react-icons/fi";

/* Piezas visuales compartidas. */
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
/* Convierte errores a texto. */
import { errorMessageFrom } from "../../lib/formErrors";
/* El proyecto que entregó el detalle a esta pantalla. */
import { useProjectOutlet } from "../projects/outlet";
/* Función que valida enlaces seguros (carpeta de investigación). */
import { safeHref } from "../research/constants";
/* El mapa y las consultas de geocodificación y búsqueda de lugares. */
import { GeoMap } from "./GeoMap";
import { useGeocode, useNearbyPlaces } from "./queries";
/* Tipos de ubicación y de parámetros de búsqueda. */
import type { GeoPlace, GeoSearchParams } from "./types";

/**
 * RADIUS_OPTIONS son los radios que se pueden elegir: 500 m, 1 km, 2.5 km y 5 km.
 * Son los mismos del laboratorio de administración. El servidor acepta de 100 a 5000 metros.
 */
/** Define RADIUS_OPTIONS para el bloque de mapa y zonas. */
const RADIUS_OPTIONS = [
  { value: "500", label: "500 m" },
  { value: "1000", label: "1 km" },
  { value: "2500", label: "2.5 km" },
  { value: "5000", label: "5 km" },
];

/**
 * GeoExplorer dibuja el panel completo y guarda lo que la persona elige.
 *
 * Estados principales que guarda:
 * - query: el texto de la zona que escribe.
 * - location: la zona elegida (puede venir de una coincidencia, de su ubicación o del mapa).
 * - geocodeResults: las coincidencias de la última búsqueda por nombre.
 * - search: los parámetros de la búsqueda de lugares. Mientras es null, no se busca nada.
 * - customKeyword y radius: el tipo de negocio y el radio.
 * - geoError y locating: errores y el estado de "buscando mi ubicación".
 */
/** Expone la funcion geo explorer para el flujo de geo. */
export function GeoExplorer() {
  // El proyecto actual. Las búsquedas de lugares se guardan dentro de él.
  const { project } = useProjectOutlet();
  // El texto de la zona que escribe la persona.
  const [query, setQuery] = useState("");
  // La zona elegida, o null si todavía no hay ninguna.
  const [location, setLocation] = useState<GeoPlace | null>(null);
  // Las coincidencias de la última búsqueda por nombre.
  const [geocodeResults, setGeocodeResults] = useState<GeoPlace[]>([]);
  // Los parámetros de la búsqueda de lugares. Si es null, todavía no se ha pedido ninguna.
  const [search, setSearch] = useState<GeoSearchParams | null>(null);
  // El tipo de negocio a buscar (por ejemplo "heladerías").
  const [customKeyword, setCustomKeyword] = useState("");
  // El radio elegido, en metros. Por defecto, 1 km.
  const [radius, setRadius] = useState(1000);
  // El mensaje de error del panel, o null si no hay error.
  const [geoError, setGeoError] = useState<string | null>(null);
  // true mientras se pide la ubicación del dispositivo.
  const [locating, setLocating] = useState(false);
  // La acción de buscar una zona por nombre.
  const geocode = useGeocode();
  // Los lugares de la búsqueda actual. Solo se pide cuando "search" tiene datos.
  const places = useNearbyPlaces(project.id, search);

  /**
   * searchLocation busca una zona por nombre. Limpia la zona y la búsqueda anterior, pide las coincidencias
   * y, si no hay ninguna, muestra un aviso. No hace nada si el texto tiene menos de 3 letras.
   */
  /** Gestiona search location de mapa y zonas. */
  async function searchLocation(event: FormEvent<HTMLFormElement>) {
    // Evita que la página se recargue al enviar el formulario.
    event.preventDefault();
    // Texto sin espacios de los extremos.
    const value = query.trim();
    // No busca si es muy corto o si ya hay una búsqueda en curso.
    /** Rama condicional: value.length < 3 || geocode.isPending. */
    if (value.length < 3 || geocode.isPending) return;
    // Limpiamos lo anterior antes de buscar de nuevo.
    setGeoError(null);
    setLocation(null);
    setSearch(null);
    setGeocodeResults([]);
    // "try" captura errores de la búsqueda y los muestra en el panel.
    /** Maneja fallos de la operacion del bloque mapa y zonas. */
    try {
      const matches = await geocode.mutateAsync(value);
      setGeocodeResults(matches);
      // Si no hay coincidencias, avisamos con un mensaje claro.
      /** Rama condicional: matches.length === 0. */
      if (matches.length === 0) setGeoError("No se encontraron coincidencias para esa búsqueda.");
    } catch (error) {
      setGeoError(errorMessageFrom(error));
    }
  }

  /**
   * useDeviceLocation pide la ubicación del dispositivo (el navegador pide permiso). Si la persona
   * acepta, esa posición se vuelve la zona elegida. Si no, muestra un mensaje según el motivo.
   * Pide la posición con poca precisión y acepta una posición guardada de hasta 5 minutos.
   * Si tarda más de 12 segundos, se rinde.
   */
  /** Coordina use device location de mapa y zonas. */
  function useDeviceLocation() {
    // Si el navegador no tiene geolocalización, lo decimos y terminamos.
    /** Rama condicional: !navigator.geolocation. */
    if (!navigator.geolocation) {
      setGeoError("Este navegador no permite compartir la ubicación del dispositivo.");
      return;
    }
    // Limpiamos lo anterior y marcamos que estamos buscando la ubicación.
    setGeoError(null);
    setGeocodeResults([]);
    setSearch(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      // Éxito: la posición se vuelve la zona elegida, con este nombre fijo.
      ({ coords }) => {
        setLocation({
          place_id: "device-location",
          display_name: "Ubicación de este dispositivo",
          latitude: coords.latitude,
          longitude: coords.longitude,
          category: null,
          place_type: null,
        });
        // Vaciamos el texto de búsqueda y terminamos la espera.
        setQuery("");
        setLocating(false);
      },
      // Error: mensaje distinto si la persona negó el permiso o si hubo otro problema.
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "No concediste permiso para acceder a la ubicación."
            : "No se pudo obtener la ubicación; busca una localidad manualmente.",
        );
        setLocating(false);
      },
      // Opciones: precisión normal, acepta una posición guardada de hasta 5 minutos (300000 ms),
      // y se rinde a los 12 segundos (12000 ms).
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 12_000 },
    );
  }

  /**
   * pickOnMap se ejecuta cuando la persona toca el mapa. Crea una zona con esas coordenadas y su
   * nombre muestra los números con 4 decimales.
   */
  /** Gestiona pick on map de mapa y zonas. */
  function pickOnMap(latitude: number, longitude: number) {
    const picked: GeoPlace = {
      place_id: `map:${latitude.toFixed(5)},${longitude.toFixed(5)}`,
      display_name: `Punto en el mapa (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      latitude,
      longitude,
      category: null,
      place_type: null,
    };
    setGeoError(null);
    setLocation(picked);
  }

  /**
   * exploreNearby arma los parámetros de la búsqueda de lugares con la zona elegida, el radio y el tipo
   * de negocio. No busca si no hay zona o si el tipo de negocio está vacío.
   * Siempre usa la categoría "all" y deja el tipo de negocio como palabra clave.
   */
  /** Gestiona explore nearby de mapa y zonas. */
  function exploreNearby() {
    // Sin zona elegida, no hay nada que buscar.
    /** Rama condicional: !location. */
    if (!location) return;
    // El tipo de negocio sin espacios de los extremos.
    const trimmedKeyword = customKeyword.trim();
    // Sin tipo de negocio, tampoco buscamos.
    /** Rama condicional: !trimmedKeyword. */
    if (!trimmedKeyword) return;
    setGeoError(null);
    setSearch({
      latitude: location.latitude,
      longitude: location.longitude,
      radius_m: radius,
      category: "all",
      keyword: trimmedKeyword,
    });
  }

  // El botón de explorar solo se activa si hay zona y el tipo de negocio tiene al menos 2 letras.
  const canExplore = location !== null && customKeyword.trim().length >= 2;

  return (
    // La tarjeta principal del panel. En pantallas grandes, el mapa y la lista quedan lado a lado.
    <GlassPanel className="flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
      {/* El encabezado: título y la explicación de cómo funciona la búsqueda. */}
      <header>
        <p className="font-mono-tech text-xs tracking-[0.18em] text-accent-cyan uppercase">
          Exploración geográfica
        </p>
        <h3 className="font-display mt-1 text-xl font-bold">Entorno y lugares mapeados</h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Busca un área y consulta lugares que OpenStreetMap tiene registrados. Envía cada
          búsqueda de forma explícita; no hay autocompletado ni ubicación en segundo plano.
        </p>
      </header>

      {/* El formulario para buscar la zona por nombre. El botón de usar ubicación no envía el formulario. */}
      <form onSubmit={(event) => void searchLocation(event)} className="flex flex-col gap-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Localidad, dirección o zona
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={160}
              placeholder="Ej.: Toluca, Estado de México"
              autoComplete="off"
              className="neo-inset h-11 w-full rounded-xl px-3.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            />
          </label>
          {/* Buscar zona: se activa con al menos 3 letras. */}
          <Button
            type="submit"
            size="sm"
            icon={<FiSearch aria-hidden="true" />}
            loading={geocode.isPending}
            disabled={query.trim().length < 3}
          >
            Buscar zona
          </Button>
          {/* Usar mi ubicación: no es parte del formulario (type="button"), así que no lo envía. */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<FiCrosshair aria-hidden="true" />}
            loading={locating}
            onClick={useDeviceLocation}
          >
            Usar mi ubicación
          </Button>
        </div>
      </form>

      {/* Las coincidencias de la búsqueda por nombre. La persona toca la que quiso decir. */}
      {geocodeResults.length > 0 && (
        <section aria-label="Coincidencias de ubicación" className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-300">
            Elige el lugar que quisiste buscar:
          </p>
          <div className="flex flex-col gap-2">
            {geocodeResults.map((place) => (
              <button
                key={place.place_id}
                type="button"
                // Al elegir una coincidencia, se vuelve la zona elegida y se quita la búsqueda anterior.
                onClick={() => {
                  setLocation(place);
                  setSearch(null);
                }}
                // La coincidencia elegida se resalta con un anillo cian.
                className={`neo-raised jelly flex items-start gap-2 rounded-xl p-3 text-left text-sm ${
                  location?.place_id === place.place_id
                    ? "ring-1 ring-accent-cyan/50"
                    : "hover:ring-1 hover:ring-white/15"
                }`}
              >
                <FiMapPin aria-hidden="true" className="mt-0.5 shrink-0 text-accent-cyan" />
                <span className="min-w-0">{place.display_name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* La fila del tipo de negocio, el radio y el botón de explorar. */}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tipo de lugar o negocio a buscar
          <input
            value={customKeyword}
            onChange={(event) => setCustomKeyword(event.target.value)}
            onKeyDown={(event) => {
              // La tecla Enter explora, siempre que el botón esté activo.
              /** Rama condicional: event.key === "Enter" && canExplore. */
              if (event.key === "Enter" && canExplore) {
                event.preventDefault();
                exploreNearby();
              }
            }}
            maxLength={80}
            placeholder="Ej.: heladerías, panaderías, ropa, gimnasios, cafeterías…"
            autoComplete="off"
            className="neo-inset h-11 w-full rounded-xl px-3.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          />
        </label>
        <Select
          label="Radio de búsqueda"
          value={String(radius)}
          options={RADIUS_OPTIONS}
          onChange={(value) => setRadius(Number(value))}
        />
        {/* El botón cambia de texto si ya hay una búsqueda. "loading" muestra la carga mientras busca. */}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={places.isFetching}
          disabled={!canExplore}
          onClick={exploreNearby}
        >
          {search ? "Actualizar lugares" : "Explorar alrededores"}
        </Button>
      </div>

      {/* Errores del panel y de la búsqueda de lugares. */}
      {geoError && <Alert>{geoError}</Alert>}
      {places.isError && <Alert>{errorMessageFrom(places.error)}</Alert>}

      {/* La zona de resultados: el mapa a la izquierda y la lista de lugares a la derecha. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          {/* Un texto que cambia según la zona elegida. "role=status" lo anuncia a lectores de pantalla. */}
          <p role="status" className="text-xs text-slate-400">
            {location
              ? `Centro seleccionado: ${location.display_name} · Haz clic en otro punto del mapa o arrastra el marcador para mover la zona.`
              : "Haz clic directamente sobre cualquier punto del mapa para elegir la zona o búscala por nombre arriba."}
          </p>
          {/* El mapa. Si la búsqueda existe, el radio es el de la búsqueda; si no, el que está elegido. */}
          <GeoMap
            center={location}
            places={places.data?.places ?? []}
            radiusM={search?.radius_m ?? radius}
            onSelectLocation={pickOnMap}
          />
          <p className="text-xs text-slate-500">
            Mapa y lugares © OpenStreetMap contributors. Las teselas se cargan desde sus
            servidores y no se guardan para uso sin conexión.
          </p>
        </div>

        <section aria-label="Lugares cercanos" className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-display font-semibold">Lugares registrados</h4>
            {/* El número de lugares encontrados, solo cuando ya hay resultados. */}
            {places.data && <Badge>{places.data.places.length}</Badge>}
          </div>
          {/* Mensajes en orden: sin zona, sin búsqueda, cargando, con lugares, o sin lugares. */}
          {!location ? (
            <p className="text-sm text-slate-400">
              Haz clic en el mapa o busca una localidad arriba para fijar el punto central.
            </p>
          ) : !search ? (
            <p className="text-sm text-slate-400">
              Escribe el giro o negocio que quieres consultar y pulsa “Explorar alrededores”.
            </p>
          ) : places.isPending ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner className="size-4 text-accent-cyan" /> Consultando el área seleccionada…
            </p>
          ) : places.data?.places.length ? (
            <ul className="flex max-h-[25rem] flex-col gap-2 overflow-y-auto pr-1">
              {places.data.places.map((place) => {
                // Enlaces seguros: la ficha de OpenStreetMap y el sitio del negocio (si tiene).
                const link = safeHref(place.osm_url);
                const website = place.website ? safeHref(place.website) : undefined;
                return (
                  <li key={`${place.osm_type}-${place.osm_id}`} className="neo-inset rounded-xl p-3">
                    <p className="font-medium text-slate-100">{place.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {place.subtype ?? place.category}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                      {/* Cada enlace aparece solo si la dirección es segura. Se abre en pestaña nueva. */}
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-accent-cyan underline underline-offset-2"
                        >
                          Ver en OpenStreetMap
                        </a>
                      )}
                      {website && (
                        <a
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-slate-400 underline underline-offset-2"
                        >
                          Sitio del negocio
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : places.isFetched ? (
            // La búsqueda terminó sin lugares. Aclaramos que no prueba que no existan negocios.
            <p className="neo-inset rounded-xl p-3 text-sm text-slate-400">
              No hay lugares de este giro mapeados en el radio seleccionado. Esto no demuestra que
              no existan negocios; valida el área con otras fuentes.
            </p>
          ) : null}
          {/* La advertencia que manda el servidor, al pie de la lista. */}
          {places.data && <p className="text-xs leading-relaxed text-slate-500">{places.data.caveat}</p>}
        </section>
      </div>
      {/* El botón para llevar esta zona al veredicto. Pasa los datos por la dirección (zona, lat, lon, radio y giro). */}
      {search && location && (
        <div className="flex justify-end">
          <LinkButton
            to={`/proyectos/${project.id}/reportes?${new URLSearchParams({
              zona: location.display_name,
              lat: String(location.latitude),
              lon: String(location.longitude),
              radio: String(search.radius_m),
              giro: search.keyword ?? "",
            }).toString()}`}
            variant="secondary"
          >
            Usar esta zona en el veredicto
          </LinkButton>
        </div>
      )}
    </GlassPanel>
  );
}
