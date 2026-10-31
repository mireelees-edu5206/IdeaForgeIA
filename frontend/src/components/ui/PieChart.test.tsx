/** Pruebas del pastel y la dona: leyenda, rebanadas y aviso cuando no hay datos. */
import { render, screen, within } from "@testing-library/react";
import { FiPieChart } from "react-icons/fi";
import { describe, expect, it } from "vitest";

import { PieChart } from "./PieChart";

const ENTRIES = [
  { label: "Mercado", count: 3 },
  { label: "Clientes", count: 1 },
  { label: "Competencia", count: 0 },
];

describe("PieChart", () => {
  it("muestra el título, la leyenda con cada número y solo dibuja rebanadas con datos", () => {
    const { container } = render(
      <PieChart id="temas" title="Temas" explanation="Qué temas aparecen." icon={FiPieChart} entries={ENTRIES} />,
    );

    const region = screen.getByRole("region", { name: "Temas" });
    const legend = within(region).getByRole("list", { name: "Leyenda: Temas" });
    expect(within(legend).getByText("Mercado").closest("li")).toHaveTextContent("Mercado3");
    expect(within(legend).getByText("Competencia").closest("li")).toHaveTextContent("Competencia0");
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(screen.getByRole("img", { name: /Temas: Mercado 3, Clientes 1/ })).toBeInTheDocument();
  });

  it("dibuja la dona con hueco y el pastel sin hueco", () => {
    const { container, rerender } = render(
      <PieChart id="t" title="T" explanation="" icon={FiPieChart} entries={ENTRIES} />,
    );
    expect(container.querySelector("circle")).toHaveAttribute("stroke-width", "50");

    rerender(<PieChart id="t" title="T" explanation="" icon={FiPieChart} entries={ENTRIES} donut />);
    expect(container.querySelector("circle")).toHaveAttribute("stroke-width", "18");
  });

  it("muestra un aviso en lugar de un círculo vacío cuando no hay datos", () => {
    render(
      <PieChart
        id="vacio"
        title="Vacío"
        explanation=""
        icon={FiPieChart}
        entries={[{ label: "Nada", count: 0 }]}
      />,
    );

    expect(screen.getByText("Todavía no hay datos para mostrar.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("usa colores hexadecimales propios y descarta clases de Tailwind", () => {
    const { container } = render(
      <PieChart
        id="colores"
        title="Colores"
        explanation=""
        icon={FiPieChart}
        entries={[
          { label: "Propio", count: 1, color: "#123456" },
          { label: "Clase", count: 1, color: "bg-rose-400" },
        ]}
      />,
    );

    const strokes = Array.from(container.querySelectorAll("circle")).map((circle) => circle.getAttribute("stroke"));
    expect(strokes[0]).toBe("#123456");
    expect(strokes[1]).toMatch(/^#/);
  });
});
