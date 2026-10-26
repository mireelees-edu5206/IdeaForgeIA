import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch } from "../../test/fetchMock";
import { apiRoutes, renderRoutes } from "../../test/render";
import { projectDetailRoute } from "../projects/routes";
import type { ProjectDetail } from "../projects/types";
import type { GeoPlace, GeoPlacesResponse } from "./types";

vi.mock("./GeoMap", () => ({
  GeoMap: ({ center }: { center: GeoPlace | null }) => (
    <div role="region" aria-label={`Mapa de prueba: ${center?.display_name ?? "vacío"}`} />
  ),
}));

const NOW = "2026-10-15T10:00:00Z";
const PROJECT: ProjectDetail = {
  id: "p1",
  title: "Ropa básica",
  raw_idea: "Marca de ropa básica y lisa para jóvenes.",
  status: "analyzed",
  created_at: NOW,
  updated_at: NOW,
  attributes: [],
  structure: { ready: true, missing: [], pending_suggestions: 0 },
};
const PLACE: GeoPlace = {
  place_id: "osm:1",
  display_name: "Toluca, México",
  latitude: 19.2925,
  longitude: -99.6569,
  category: "boundary",
  place_type: "administrative",
};
const NEARBY: GeoPlacesResponse = {
  latitude: PLACE.latitude,
  longitude: PLACE.longitude,
  radius_m: 1000,
  category: "all",
  attribution: "© OpenStreetMap contributors",
  caveat: "El registro no confirma que sean competidores.",
  places: [
    {
      osm_type: "node",
      osm_id: 42,
      osm_url: "https://www.openstreetmap.org/node/42",
      name: "Tienda local",
      latitude: PLACE.latitude,
      longitude: PLACE.longitude,
      category: "all",
      subtype: "clothes",
      website: null,
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("Exploración geográfica", () => {
  it("no geocodifica mientras se escribe y busca lugares solo tras confirmarlo", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(
      apiRoutes([
        { path: "/api/v1/projects/p1", respond: () => jsonResponse(200, PROJECT) },
        { path: "/api/v1/projects/p1/competitors", respond: () => jsonResponse(200, []) },
        { path: "/api/v1/projects/p1/entities", respond: () => jsonResponse(200, []) },
        {
          path: "/api/v1/geo/geocode",
          respond: () => jsonResponse(200, [PLACE]),
        },
        {
          path: "/api/v1/projects/p1/geo/places",
          respond: () => jsonResponse(200, NEARBY),
        },
      ]),
    );
    renderRoutes([projectDetailRoute], "/proyectos/p1/competidores");

    await screen.findByRole("heading", { name: "Entorno y lugares mapeados" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/geo/"))).toBe(false);

    await user.type(screen.getByLabelText("Localidad, dirección o zona"), "Toluca");
    await user.click(screen.getByRole("button", { name: "Buscar zona" }));
    await user.click(await screen.findByRole("button", { name: "Toluca, México" }));
    expect(
      await screen.findByRole("region", { name: "Mapa de prueba: Toluca, México" }),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/geo/geocode")),
    ).toHaveLength(1);

    await user.type(screen.getByLabelText("Tipo de lugar o negocio a buscar"), "ropa");
    await user.click(screen.getByRole("button", { name: "Explorar alrededores" }));
    expect(await screen.findByText("Tienda local")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("/geo/places")),
    ).toBe(true);
    const verdictLink = screen.getByRole("link", { name: "Usar esta zona en el veredicto" });
    const verdictUrl = new URL(verdictLink.getAttribute("href")!, "http://localhost");
    expect(verdictUrl.pathname).toBe("/proyectos/p1/reportes");
    expect(verdictUrl.searchParams.get("lat")).toBe(String(PLACE.latitude));
    expect(verdictUrl.searchParams.get("lon")).toBe(String(PLACE.longitude));
    expect(verdictUrl.searchParams.get("giro")).toBe("ropa");
    await waitFor(() =>
      expect(screen.getByText(/no confirma que sean competidores/i)).toBeInTheDocument(),
    );
  });
});
