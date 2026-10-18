import { apiRequest } from "../../lib/apiClient";
import type { GeoPlace, GeoPlacesResponse, GeoSearchParams } from "./types";

export const geoApi = {
  geocode: (query: string) =>
    apiRequest<GeoPlace[]>(`/geo/geocode?q=${encodeURIComponent(query)}`),
  nearbyPlaces: (projectId: string, params: GeoSearchParams) => {
    const search = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      radius_m: String(params.radius_m),
      category: params.category,
    });
    return apiRequest<GeoPlacesResponse>(
      `/projects/${projectId}/geo/places?${search.toString()}`,
    );
  },
};
