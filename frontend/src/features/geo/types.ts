/**
 * ARCHIVO: geo/types.ts
 *
 * ¿Qué es?
 * Son las "fichas de forma" de la parte de mapa y zonas: cómo se ve una ubicación, un negocio
 * encontrado en el mapa, la respuesta de búsqueda de lugares y los datos que se mandan para buscar.
 * Describen la forma de los datos, sin dibujar nada.
 *
 * ¿Para qué sirve?
 * TypeScript usa estas fichas para avisar si se escribe mal un campo o una categoría que no existe.
 *
 * ¿Quién lo usa?
 * api.ts, queries.ts, GeoMap.tsx, GeoExplorer.tsx, y también la carpeta de administración
 * (admin/types.ts y AdminLabPage.tsx) para el laboratorio.
 *
 * Nota de coordenadas: latitud (latitude) es el número norte-sur y longitud (longitude) el número
 * este-oeste. Se expresan en grados decimales, por ejemplo 19.2925 y -99.6569 (Toluca).
 */

/**
 * GeoCategory es el tipo de negocio que se busca: "all" (todos), "clothing" (ropa), "food" (comida),
 * "groceries" (abarrotes) o "services" (servicios). La pantalla actual siempre envía "all"
 * y usa la palabra clave para afinar la búsqueda.
 */
export type GeoCategory = "all" | "clothing" | "food" | "groceries" | "services";

/**
 * GeoPlace es una ubicación del mapa, por ejemplo una zona que buscaste por nombre o un punto que
 * tocaste en el mapa:
 * - place_id: un identificador único de esa ubicación.
 * - display_name: el texto que se muestra al usuario, como "Toluca, Estado de México".
 * - latitude y longitude: el punto exacto.
 * - category y place_type: la clasificación que da el mapa. Pueden ser null si no existe.
 */
/** Describe el contrato geo place utilizado por geo. */
export interface GeoPlace {
  place_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  category: string | null;
  place_type: string | null;
}

/**
 * GeoBusiness es un negocio o lugar registrado en OpenStreetMap:
 * - osm_type y osm_id: su identificador dentro de OpenStreetMap ("node", "way" o "relation" más un número).
 * - osm_url: la dirección de su ficha en OpenStreetMap.
 * - name, latitude, longitude: su nombre y su ubicación.
 * - category y subtype: qué tipo de negocio es. subtype puede ser null.
 * - website: su sitio web, o null si no lo tiene registrado.
 */
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

/**
 * GeoPlacesResponse es la respuesta de buscar lugares alrededor de un punto:
 * - latitude, longitude y radius_m: el centro y el radio que se usaron.
 * - category y keyword: el tipo y la palabra clave usados (keyword puede ser null o faltar).
 * - places: la lista de negocios encontrados.
 * - attribution: el texto que da crédito a OpenStreetMap.
 * - caveat: la advertencia de que no encontrar un lugar no prueba que no exista.
 */
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

/**
 * GeoSearchParams son los datos que se mandan para buscar lugares: el centro (latitude, longitude),
 * el radio en metros, la categoría y, opcionalmente, una palabra clave. El "?" en keyword significa
 * que puede faltar.
 */
/** Describe el contrato geo search params utilizado por geo. */
export interface GeoSearchParams {
  latitude: number;
  longitude: number;
  radius_m: number;
  category: GeoCategory;
  keyword?: string;
}
