/**
 * ARCHIVO: admin/lab/labFormat.ts
 *
 * ¿Qué es?
 * Es la "hoja de textos y formatos" del laboratorio: los nombres en español de cada método, la guía
 * en lenguaje sencillo que aparece en la pantalla, y una función que escribe las distancias de forma
 * fácil de leer (metros o kilómetros).
 *
 * ¿Para qué sirve?
 * Para que la pantalla no muestre códigos como "hill_climbing" o "greedy_ratio", sino nombres
 * claros. Cambiar un texto de método o una explicación se hace aquí, en un solo lugar.
 *
 * ¿Quién lo usa?
 * AdminLabPage.tsx (los menús de método, la guía y las distancias) y labFormat.test.ts (sus pruebas).
 *
 * Importante: los códigos de la izquierda (bfs, greedy, exact...) deben coincidir con los del backend.
 * Si agregas o quitas un método, cámbialo en types.ts, en esta hoja y en el backend.
 */

/* Tipos de cada familia de métodos, definidos en la carpeta de admin. */
import type { BudgetAlgorithm, RouteAlgorithm, TraceAlgorithm } from "../types";

/**
 * TRACE_ALGORITHM_LABELS da el nombre en español de cada método del recorrido de trazabilidad.
 * Se usa así: TRACE_ALGORITHM_LABELS["bfs"] devuelve "Búsqueda ciega en anchura (BFS)".
 */
/** Nombre en español de cada búsqueda del recorrido de trazabilidad (se muestra en vez del código). */
export const TRACE_ALGORITHM_LABELS: Record<TraceAlgorithm, string> = {
  bfs: "Búsqueda ciega en anchura (BFS)",
  dfs: "Búsqueda ciega en profundidad (DFS)",
  greedy: "Búsqueda con heurística voraz",
  astar: "Búsqueda A* (heurística + pasos recorridos)",
};

/**
 * ROUTE_ALGORITHM_LABELS da el nombre en español de cada método para ordenar la ruta.
 * La opción "exact" dice "máx. 8 lugares" porque con más lugares tardaría demasiado.
 */
/** Nombre en español de cada método para ordenar la ruta de visita. */
export const ROUTE_ALGORITHM_LABELS: Record<RouteAlgorithm, string> = {
  exact: "Óptimo exacto (prueba todas las rutas; máx. 8 lugares)",
  nearest_neighbor: "Heurística del vecino más cercano",
  hill_climbing: "Búsqueda local por intercambio",
  two_opt: "Búsqueda local 2-opt",
  genetic: "Algoritmo genético",
};

/** BUDGET_ALGORITHM_LABELS da el nombre en español de cada método para elegir hipótesis con presupuesto. */
/** Nombre en español de cada método para elegir hipótesis con presupuesto. */
export const BUDGET_ALGORITHM_LABELS: Record<BudgetAlgorithm, string> = {
  exact: "Óptimo exacto (prueba todas las combinaciones)",
  hill_climbing: "Búsqueda local (agregar o quitar hipótesis)",
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
    name: "Anchura (BFS) y profundidad (DFS)",
    idea: "Revisan el mapa de relaciones sin ninguna pista. BFS revisa primero lo más cercano; DFS se mete hasta el fondo de una rama antes de volver.",
    guarantee: "BFS encuentra el camino con menos pasos. DFS encuentra un camino, pero no necesariamente el más corto.",
  },
  {
    family: "Heurística",
    name: "Voraz y A*",
    idea: "Usan una pista (la heurística) para decidir qué revisar primero. La pista aquí es la diferencia de nivel entre un elemento y el objetivo: idea, investigación, fuente, hallazgo o competidor.",
    guarantee: "La voraz es rápida, pero puede tomar un camino largo. A* busca el camino corto, pero solo lo asegura si la pista nunca exagera.",
  },
  {
    family: "Heurística",
    name: "Vecino más cercano",
    idea: "Desde el punto de partida, siempre visita la parada más próxima que todavía falta.",
    guarantee: "Es rápido, pero casi nunca da la ruta más corta.",
  },
  {
    family: "Búsqueda local",
    name: "Intercambio y 2-opt",
    idea: "Parten de una ruta y prueban cambios pequeños (intercambiar dos paradas o invertir un tramo). Conservan solo los cambios que acortan la distancia.",
    guarantee: "Mejora la ruta, pero puede quedarse en una solución que solo es buena localmente.",
  },
  {
    family: "Algoritmo genético",
    name: "Genético",
    idea: "Crea muchas rutas al azar, las combina y mantiene las mejores generación tras generación, como una selección natural.",
    guarantee: "Con la misma semilla da siempre el mismo resultado, pero no asegura el óptimo.",
  },
  {
    family: "Óptimo exacto",
    name: "Fuerza bruta",
    idea: "Prueba todas las posibilidades y se queda con la mejor. Solo es práctico con pocos elementos.",
    guarantee: "Siempre da la mejor respuesta, pero con muchos elementos tarda demasiado.",
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
