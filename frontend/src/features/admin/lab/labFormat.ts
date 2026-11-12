/**
 * ARCHIVO: admin/lab/labFormat.ts
 *
 * ¿Qué es?
 * Es la "hoja de textos y formatos" del laboratorio: los nombres en español de cada método, la guía
 * en lenguaje sencillo que aparece en la pantalla, y una función que escribe las distancias de forma
 * fácil de leer (metros o kilómetros).
 *
 * ¿Para qué sirve?
 * Para que la pantalla no muestre códigos como "exact" o "greedy_ratio", sino nombres
 * claros. Cambiar un texto de método o una explicación se hace aquí, en un solo lugar.
 *
 * ¿Quién lo usa?
 * AdminLabPage.tsx (los menús de método, la guía y las distancias) y labFormat.test.ts (sus pruebas).
 *
 * Importante: los códigos de la izquierda (exact, nearest_neighbor, greedy_ratio) deben coincidir
 * con los del backend. Si agregas o quitas un método, cámbialo en types.ts, en esta hoja y en el backend.
 */

/* Tipos de cada familia de métodos, definidos en la carpeta de admin. */
import type { BudgetAlgorithm, RouteAlgorithm } from "../types";

/**
 * ROUTE_ALGORITHM_LABELS da el nombre en español de cada método para ordenar la ruta.
 * La opción "exact" dice "máx. 8 lugares" porque con más lugares tardaría demasiado.
 */
/** Nombre en español de cada método para ordenar la ruta de visita. */
export const ROUTE_ALGORITHM_LABELS: Record<RouteAlgorithm, string> = {
  exact: "Óptimo exacto (prueba todas las rutas; máx. 8 lugares)",
  nearest_neighbor: "Heurística del vecino más cercano",
};

/** BUDGET_ALGORITHM_LABELS da el nombre en español de cada método para elegir hipótesis con presupuesto. */
/** Nombre en español de cada método para elegir hipótesis con presupuesto. */
export const BUDGET_ALGORITHM_LABELS: Record<BudgetAlgorithm, string> = {
  exact: "Óptimo exacto (prueba todas las combinaciones; máx. 16 hipótesis)",
  greedy_ratio: "Heurística voraz (mayor valor por costo primero)",
};

/**
 * ALGORITHM_GUIDE es la lista de tarjetas de la guía. Cada tarjeta tiene cuatro textos:
 * - family: la familia del método (por ejemplo "Búsqueda ciega"). Es la etiqueta pequeña de arriba.
 * - name: el nombre de la tarjeta.
 * - idea: qué hace el método, en palabras simples.
 * - guarantee: si asegura la mejor respuesta o no.
 * Para agregar una tarjeta, copia una línea completa y cambia sus textos.
 */
/** Guía en lenguaje sencillo: qué hace cada método y si garantiza la mejor respuesta. */
export const ALGORITHM_GUIDE: Array<{
  family: string;
  name: string;
  idea: string;
  guarantee: string;
}> = [
  {
    family: "Búsqueda ciega",
    name: "Anchura (BFS)",
    idea: "Revisa el mapa de relaciones sin ninguna pista, capa por capa: primero lo que está a 1 paso, luego a 2 pasos, y así sucesivamente.",
    guarantee: "Encuentra el camino con menos pasos entre la idea y el elemento buscado.",
  },
  {
    family: "Heurística",
    name: "Vecino más cercano",
    idea: "Desde el punto de partida, siempre visita la parada más próxima que todavía falta.",
    guarantee: "Es rápido, pero casi nunca da la ruta más corta.",
  },
  {
    family: "Óptimo exacto",
    name: "Fuerza bruta",
    idea: "Prueba todas las posibilidades y se queda con la mejor. Solo es práctico con pocos elementos (hasta 8 paradas o 16 hipótesis).",
    guarantee: "Siempre da la mejor respuesta, pero con muchos elementos tarda demasiado.",
  },
  {
    family: "Heurística",
    name: "Voraz por valor y costo",
    idea: "Ordena las hipótesis por valor esperado entre costo y toma las que quepan en el presupuesto, en ese orden.",
    guarantee: "Es rápida y suele acercarse al mejor resultado, pero puede dejar de lado una combinación mejor.",
  },
];

/**
 * formatDistance convierte kilómetros en un texto fácil de leer.
 *
 * Reglas:
 * - Si la distancia no es un número válido (por ejemplo NaN o infinito), devuelve un guion largo "—".
 * - Si es menor a 1 km, la muestra en metros, redondeados: 0.85 km → "850 m".
 * - Si es 1 km o más, la muestra en kilómetros con dos decimales: 1.234 km → "1.23 km".
 *   "toLocaleString" con "es-MX" usa el formato de México (punto para los decimales).
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}
