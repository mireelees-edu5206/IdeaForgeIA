/** Funciones HTTP del modulo mapa y zonas. */
import { apiRequest } from "../../lib/apiClient";
import type { GeoPlace, GeoPlacesResponse, GeoSearchParams } from "./types";

/** Define geo api como dato o funcion publica de geo. */
export const geoApi = {
  geocode: (query: string, signal?: AbortSignal) =>
    apiRequest<GeoPlace[]>(`/geo/geocode?q=${encodeURIComponent(query)}`, { signal }),
  nearbyPlaces: (projectId: string, params: GeoSearchParams, signal?: AbortSignal) => {
    const search = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius_m: String(params.radius_m),
      category: params.category,
    });
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
