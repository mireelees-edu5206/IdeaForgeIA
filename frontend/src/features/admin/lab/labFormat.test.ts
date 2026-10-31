/** Pruebas de los textos y formatos del Laboratorio: distancias legibles y nombres en español. */
import { describe, expect, it } from "vitest";

import { formatDistance, ROUTE_ALGORITHM_LABELS, TRACE_ALGORITHM_LABELS } from "./labFormat";

describe("formatDistance", () => {
  it("muestra distancias menores a un kilómetro en metros", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(0)).toBe("0 m");
  });

  it("muestra distancias de un kilómetro o más con dos decimales", () => {
    expect(formatDistance(1.234)).toMatch(/^1[.,]23 km$/);
    expect(formatDistance(12)).toMatch(/^12[.,]00 km$/);
  });

  it("no muestra números inválidos", () => {
    expect(formatDistance(Number.NaN)).toBe("—");
  });
});

describe("nombres de algoritmos", () => {
  it("describe la búsqueda con heurística en lenguaje sencillo", () => {
    expect(TRACE_ALGORITHM_LABELS.greedy).toBe("Búsqueda con heurística voraz");
    expect(TRACE_ALGORITHM_LABELS.astar).toContain("A*");
  });

  it("no usa códigos técnicos como nombres de ruta", () => {
    expect(ROUTE_ALGORITHM_LABELS.hill_climbing).not.toContain("_");
    expect(ROUTE_ALGORITHM_LABELS.two_opt).toContain("2-opt");
  });
});
