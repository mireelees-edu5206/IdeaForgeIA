/** Tipos TypeScript de los datos de mapa y zonas. */
export type GeoCategory = "all" | "clothing" | "food" | "groceries" | "services";

/** Describe el contrato geo place utilizado por geo. */
export interface GeoPlace {
  place_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  category: string | null;
  place_type: string | null;
}

/** Describe el contrato geo business utilizado por geo. */
export interface GeoBusiness {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  osm_url: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  subtype: string | null;
  website: string | null;
}

/** Describe el contrato geo places response utilizado por geo. */
export interface GeoPlacesResponse {
  latitude: number;
  longitude: number;
  radius_m: number;
  category: GeoCategory;
  keyword?: string | null;
  places: GeoBusiness[];
  attribution: string;
  caveat: string;
}

/** Describe el contrato geo search params utilizado por geo. */
export interface GeoSearchParams {
  latitude: number;
  longitude: number;
  radius_m: number;
  category: GeoCategory;
  keyword?: string;
}
