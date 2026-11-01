/**
 * ARCHIVO: geo/api.ts
 *
 * ¿Qué es?
 * Es el "mensajero" del mapa y las zonas: sabe qué dirección del servidor usar para convertir un
 * nombre en coordenadas (geocodificar) y para buscar negocios alrededor de un punto.
 *
 * ¿Para qué sirve?
 * Las pantallas no escriben las direcciones a mano. Si el servidor cambia una ruta, solo se toca aquí.
 *
 * ¿Quién lo usa?
 * queries.ts lo llama dentro de la caché. Las pantallas no lo usan directamente.
 *
 * Importante: las búsquedas salen al servidor de IdeaForge, y el servidor consulta OpenStreetMap.
 * El navegador nunca llama directo a OpenStreetMap para buscar, así se respetan sus límites de uso.
 */

/* Función central que habla con el backend y agrega la sesión. */
import { apiRequest } from "../../lib/apiClient";
/* Fichas de forma de la respuesta y de los datos que se mandan. */
import type { GeoPlace, GeoPlacesResponse, GeoSearchParams } from "./types";

/**
 * geoApi agrupa las dos peticiones del mapa: convertir un nombre en coordenadas y buscar lugares.
 */
/** Define geo api como dato o funcion publica de geo. */
export const geoApi = {
  // Convierte el texto de una zona en una lista de coincidencias (GET /geo/geocode?q=...).
  // "encodeURIComponent" protege el texto para que caracteres como acentos o espacios viajen bien en la dirección.
  // "signal" permite cancelar la petición si la persona ya no la necesita.
  geocode: (query: string, signal?: AbortSignal) =>
    apiRequest<GeoPlace[]>(`/geo/geocode?q=${encodeURIComponent(query)}`, { signal }),
  // Busca negocios alrededor de un punto, dentro del proyecto (GET /projects/{id}/geo/places?...).
  nearbyPlaces: (projectId: string, params: GeoSearchParams, signal?: AbortSignal) => {
    // Armamos los parámetros de la dirección: centro, radio y categoría. Los números se pasan a texto.
    const search = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius_m: String(params.radius_m),
      category: params.category,
    });
    // La palabra clave solo se agrega si existe y no está vacía después de quitar espacios.
    /** Rama condicional: params.keyword?.trim(). */
    if (params.keyword?.trim()) {
      search.set("keyword", params.keyword.trim());
    }
    return apiRequest<GeoPlacesResponse>(
      `/projects/${projectId}/geo/places?${search.toString()}`,
      { signal },
    );
  },
};
