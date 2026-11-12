/** Pruebas de los textos y formatos del Laboratorio: distancias legibles y nombres en español. */
import { describe, expect, it } from "vitest";

import { BUDGET_ALGORITHM_LABELS, formatDistance, ROUTE_ALGORITHM_LABELS } from "./labFormat";

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
  it("muestra solo los métodos que existen en el servidor", () => {
    expect(Object.keys(ROUTE_ALGORITHM_LABELS).sort()).toEqual(["exact", "nearest_neighbor"]);
    expect(Object.keys(BUDGET_ALGORITHM_LABELS).sort()).toEqual(["exact", "greedy_ratio"]);
  });

  it("no usa códigos técnicos como nombres de método", () => {
    expect(ROUTE_ALGORITHM_LABELS.nearest_neighbor).not.toContain("_");
    expect(BUDGET_ALGORITHM_LABELS.greedy_ratio).not.toContain("_");
  });
});
