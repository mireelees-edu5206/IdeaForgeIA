/**
 * ARCHIVO: geo/queries.ts
 *
 * ¿Qué es?
 * Es la "memoria" del mapa y las zonas: guarda los lugares ya buscados para no repetir la misma
 * búsqueda, y ofrece la acción de convertir un nombre en coordenadas.
 *
 * ¿Para qué sirve?
 * - useGeocode: convierte el nombre de una zona en coordenadas. Es una acción manual.
 * - useNearbyPlaces: busca negocios alrededor de un punto. Solo se ejecuta cuando hay una búsqueda.
 *
 * ¿Quién lo usa?
 * GeoExplorer.tsx (en CompetitorsTab) y AdminLabPage.tsx (en el laboratorio).
 *
 * Palabras clave:
 * - "queryKey" es el nombre con el que se guarda un dato en la memoria.
 * - "staleTime" es cuánto tiempo se considera vigente un dato antes de volver a pedirlo.
 */

/* "useMutation" maneja acciones manuales y "useQuery" pide y guarda datos. */
import { useMutation, useQuery } from "@tanstack/react-query";

/* La memoria del proyecto: las búsquedas de lugares cuelgan del detalle del proyecto. */
import { projectKeys } from "../projects/queries";
/* Las peticiones al servidor y los datos que se mandan. */
import { geoApi } from "./api";
import type { GeoSearchParams } from "./types";

/**
 * geoKeys son los nombres de la memoria del mapa.
 * - geocode: el nombre de la memoria de conversiones de zona. Hoy ninguna función del proyecto lo usa
 *   (useGeocode no guarda datos en la memoria), así que es un nombre reservado por si en el futuro se guarda.
 * - places: la lista de lugares de una búsqueda concreta. Cuelga del proyecto y de los parámetros,
 *   así cada búsqueda distinta tiene su propio dato guardado.
 */
/** Define geo keys como dato o funcion publica de geo. */
export const geoKeys = {
  geocode: () => ["geo", "geocode"] as const,
  places: (projectId: string, params: GeoSearchParams | null) =>
    [...projectKeys.detail(projectId), "geo", params] as const,
};

/**
 * useGeocode devuelve la acción de buscar una zona por nombre. No guarda en memoria: cada vez que
 * la persona lo pide, se consulta de nuevo.
 *
 * Solo debe invocarse tras una búsqueda manual, nunca en cada cambio de texto.
 * Así no se hacen peticiones de más mientras la persona escribe.
 */
/** Solo debe invocarse tras una búsqueda manual, nunca en cada cambio de texto. */
export function useGeocode() {
  return useMutation({ mutationFn: (query: string) => geoApi.geocode(query) });
}

/**
 * useNearbyPlaces pide los negocios cercanos a un punto.
 *
 * Recibe:
 * - projectId: el proyecto al que pertenece la búsqueda.
 * - params: el centro, el radio y la palabra clave. Si es null, no hace ninguna petición.
 *
 * Detalles:
 * - "enabled: params !== null" evita la petición cuando todavía no hay una búsqueda.
 * - "staleTime" de 5 minutos: la misma búsqueda, repetida en ese tiempo, sale de la memoria.
 * - "retry: false": si falla, no reintenta sola. La persona decide cuándo volver a intentar.
 * - "signal" viene de la caché y permite cancelar la petición si cambian los parámetros.
 */
/** Expone la funcion use nearby places para el flujo de geo. */
export function useNearbyPlaces(projectId: string, params: GeoSearchParams | null) {
  return useQuery({
    queryKey: geoKeys.places(projectId, params),
    queryFn: ({ signal }) => geoApi.nearbyPlaces(projectId, params!, signal),
    enabled: params !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
