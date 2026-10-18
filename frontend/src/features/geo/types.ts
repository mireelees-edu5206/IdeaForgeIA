export type GeoCategory = "all" | "clothing" | "food" | "groceries" | "services";

export interface GeoPlace {
  place_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  category: string | null;
  place_type: string | null;
}

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

export interface GeoPlacesResponse {
  latitude: number;
  longitude: number;
  radius_m: number;
  category: GeoCategory;
  places: GeoBusiness[];
  attribution: string;
  caveat: string;
}

export interface GeoSearchParams {
  latitude: number;
  longitude: number;
  radius_m: number;
  category: GeoCategory;
}
