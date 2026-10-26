import { useMutation, useQuery } from "@tanstack/react-query";

import { projectKeys } from "../projects/queries";
import { geoApi } from "./api";
import type { GeoSearchParams } from "./types";

export const geoKeys = {
  geocode: () => ["geo", "geocode"] as const,
  places: (projectId: string, params: GeoSearchParams | null) =>
    [...projectKeys.detail(projectId), "geo", params] as const,
};

/** Solo debe invocarse tras una búsqueda manual, nunca en cada cambio de texto. */
export function useGeocode() {
  return useMutation({ mutationFn: (query: string) => geoApi.geocode(query) });
}

export function useNearbyPlaces(projectId: string, params: GeoSearchParams | null) {
  return useQuery({
    queryKey: geoKeys.places(projectId, params),
    queryFn: ({ signal }) => geoApi.nearbyPlaces(projectId, params!, signal),
    enabled: params !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
