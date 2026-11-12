"""Pruebas de comportamiento para admin lab algorithms."""

import pytest

from app.modules.admin.lab.algorithms import (
    find_trace_path,
    haversine_km,
    optimize_hypothesis_budget,
    optimize_project_place_route,
)

EDGES = [
    ("root", "a"),
    ("root", "b"),
    ("a", "c"),
    ("b", "goal"),
    ("c", "goal"),
]

PLACES = [
    {"place_id": "node:1", "name": "Local A", "latitude": 19.2900, "longitude": -99.6500},
    {"place_id": "node:2", "name": "Local B", "latitude": 19.3000, "longitude": -99.6600},
    {"place_id": "node:3", "name": "Local C", "latitude": 19.3100, "longitude": -99.6500},
]

HYPOTHESES = [
    {
        "id": "h1",
        "statement": "Los vecinos pagan por el producto.",
        "priority": "high",
        "estimated_cost": 400,
        "expected_value": 80,
    },
    {
        "id": "h2",
        "statement": "El canal digital atrae clientes.",
        "priority": "medium",
        "estimated_cost": 300,
        "expected_value": 50,
    },
    {
        "id": "h3",
        "statement": "La competencia copia la oferta.",
        "priority": "low",
        "estimated_cost": 600,
        "expected_value": 90,
    },
]


def test_bfs_finds_the_path_with_fewest_steps() -> None:
    """BFS encuentra el camino con menos pasos: root -> b -> goal (2 pasos, no 3)."""
    path, visited = find_trace_path("root", "goal", EDGES)

    assert path == ["root", "b", "goal"]
    assert visited[0] == "root"


def test_search_returns_empty_path_when_target_is_unreachable() -> None:
    """Si el destino no es alcanzable, BFS no devuelve camino y revisa todo el grafo."""
    path, visited = find_trace_path("root", "unknown", EDGES)

    assert path == []
    assert set(visited) == {"root", "a", "b", "c", "goal"}


def test_haversine_distance_is_zero_for_same_point_and_matches_one_degree() -> None:
    """Prueba que Haversine da cero en el mismo punto y ~111 km por grado de latitud."""
    assert haversine_km(19.29, -99.65, 19.29, -99.65) == 0
    one_degree = haversine_km(19.29, -99.65, 20.29, -99.65)
    assert 110.5 < one_degree < 111.5


def test_haversine_distance_between_two_real_points_is_reasonable() -> None:
    """Prueba una distancia real: Zócalo de CDMX a centro de Toluca (~57 km en línea recta)."""
    distance = haversine_km(19.4326, -99.1332, 19.2826, -99.6557)
    assert 55 < distance < 60


def test_nearest_neighbor_visits_every_place_and_is_never_shorter_than_exact() -> None:
    """El vecino más cercano visita todas las paradas y nunca mejora al óptimo exacto."""
    result = optimize_project_place_route(19.2850, -99.6550, PLACES, "nearest_neighbor")

    assert {p["place_id"] for p in result["ordered_places"]} == {"node:1", "node:2", "node:3"}
    assert result["total_distance_km"] >= result["optimal_reference_km"]


def test_exact_route_matches_its_own_reference_and_visits_each_place() -> None:
    """La ruta exacta coincide con su propia referencia y visita cada lugar una vez."""
    result = optimize_project_place_route(19.2850, -99.6550, PLACES, "exact")

    assert result["total_distance_km"] == result["optimal_reference_km"]
    assert result["evaluations"] == 6
    ordered = [leg["place_id"] for leg in result["legs"]]
    assert ordered[-1] == "project-location"
    assert {p["place_id"] for p in result["ordered_places"]} == {
        "node:1",
        "node:2",
        "node:3",
    }


def test_route_optimizer_rejects_out_of_bounds_groups() -> None:
    """La ruta exige entre 2 y 8 lugares."""
    with pytest.raises(ValueError, match="2 y 8"):
        optimize_project_place_route(19.28, -99.65, PLACES[:1], "exact")
    with pytest.raises(ValueError, match="2 y 8"):
        optimize_project_place_route(19.28, -99.65, PLACES * 3, "exact")


def test_route_optimizer_rejects_retired_algorithms() -> None:
    """Los algoritmos de ruta retirados (2-opt, escalada, genético) ya no se aceptan."""
    for retired in ("two_opt", "hill_climbing", "genetic"):
        with pytest.raises(ValueError, match="no soportado"):
            optimize_project_place_route(19.28, -99.65, PLACES, retired)


def test_budget_exact_picks_the_best_combination_under_budget() -> None:
    """Con presupuesto 700, la mejor combinación es h1 + h2 (valor 130)."""
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "exact")

    assert result["selected_indices"] == [0, 1]
    assert result["total_cost"] == 700
    assert result["total_value"] == 130
    assert result["exact_reference_value"] == 130


def test_greedy_budget_respects_budget_and_matches_exact_on_this_example() -> None:
    """La heurística voraz por valor/costo respeta el presupuesto y llega al óptimo aquí."""
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "greedy_ratio")

    assert result["total_cost"] <= 700
    assert result["total_value"] == result["exact_reference_value"] == 130


def test_budget_rejects_retired_hill_climbing() -> None:
    """La escalada para presupuesto fue retirada; ya no se acepta como algoritmo."""
    with pytest.raises(ValueError, match="no soportado"):
        optimize_hypothesis_budget(HYPOTHESES, 700, "hill_climbing")
