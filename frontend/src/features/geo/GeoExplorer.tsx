import { type FormEvent, useState } from "react";
import { FiCrosshair, FiMapPin, FiSearch } from "react-icons/fi";

import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { LinkButton } from "../../components/ui/LinkButton";
import { Select } from "../../components/ui/Select";
import { Spinner } from "../../components/ui/Spinner";
import { errorMessageFrom } from "../../lib/formErrors";
import { useProjectOutlet } from "../projects/outlet";
import { safeHref } from "../research/constants";
import { GeoMap } from "./GeoMap";
import { useGeocode, useNearbyPlaces } from "./queries";
import type { GeoPlace, GeoSearchParams } from "./types";

const RADIUS_OPTIONS = [
  { value: "500", label: "500 m" },
  { value: "1000", label: "1 km" },
  { value: "2500", label: "2.5 km" },
  { value: "5000", label: "5 km" },
];

export function GeoExplorer() {
  const { project } = useProjectOutlet();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<GeoPlace | null>(null);
  const [geocodeResults, setGeocodeResults] = useState<GeoPlace[]>([]);
  const [search, setSearch] = useState<GeoSearchParams | null>(null);
  const [customKeyword, setCustomKeyword] = useState("");
  const [radius, setRadius] = useState(1000);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const geocode = useGeocode();
  const places = useNearbyPlaces(project.id, search);

  async function searchLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 3 || geocode.isPending) return;
    setGeoError(null);
    setLocation(null);
    setSearch(null);
    setGeocodeResults([]);
    try {
      const matches = await geocode.mutateAsync(value);
      setGeocodeResults(matches);
      if (matches.length === 0) setGeoError("No se encontraron coincidencias para esa búsqueda.");
    } catch (error) {
      setGeoError(errorMessageFrom(error));
    }
  }

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setGeoError("Este navegador no permite compartir la ubicación del dispositivo.");
      return;
    }
    setGeoError(null);
    setGeocodeResults([]);
    setSearch(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          place_id: "device-location",
          display_name: "Ubicación de este dispositivo",
          latitude: coords.latitude,
          longitude: coords.longitude,
          category: null,
          place_type: null,
        });
        setQuery("");
        setLocating(false);
      },
      (error) => {
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? "No concediste permiso para acceder a la ubicación."
            : "No se pudo obtener la ubicación; busca una localidad manualmente.",
        );
        setLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 12_000 },
    );
  }

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

  function exploreNearby() {
    if (!location) return;
    const trimmedKeyword = customKeyword.trim();
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

  const canExplore = location !== null && customKeyword.trim().length >= 2;

  return (
    <GlassPanel className="flex flex-col gap-5 rounded-3xl p-4 sm:p-6">
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
          <Button
            type="submit"
            size="sm"
            icon={<FiSearch aria-hidden="true" />}
            loading={geocode.isPending}
            disabled={query.trim().length < 3}
          >
            Buscar zona
          </Button>
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
                onClick={() => {
                  setLocation(place);
                  setSearch(null);
                }}
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

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tipo de lugar o negocio a buscar
          <input
            value={customKeyword}
            onChange={(event) => setCustomKeyword(event.target.value)}
            onKeyDown={(event) => {
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

      {geoError && <Alert>{geoError}</Alert>}
      {places.isError && <Alert>{errorMessageFrom(places.error)}</Alert>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <p role="status" className="text-xs text-slate-400">
            {location
              ? `Centro seleccionado: ${location.display_name} · Haz clic en otro punto del mapa o arrastra el marcador para mover la zona.`
              : "Haz clic directamente sobre cualquier punto del mapa para elegir la zona o búscala por nombre arriba."}
          </p>
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
            {places.data && <Badge>{places.data.places.length}</Badge>}
          </div>
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
                const link = safeHref(place.osm_url);
                const website = place.website ? safeHref(place.website) : undefined;
                return (
                  <li key={`${place.osm_type}-${place.osm_id}`} className="neo-inset rounded-xl p-3">
                    <p className="font-medium text-slate-100">{place.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {place.subtype ?? place.category}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
            <p className="neo-inset rounded-xl p-3 text-sm text-slate-400">
              No hay lugares de este giro mapeados en el radio seleccionado. Esto no demuestra que
              no existan negocios; valida el área con otras fuentes.
            </p>
          ) : null}
          {places.data && <p className="text-xs leading-relaxed text-slate-500">{places.data.caveat}</p>}
        </section>
      </div>
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
