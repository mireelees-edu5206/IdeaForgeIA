"""Pruebas de comportamiento para admin lab algorithms."""

import pytest

from app.modules.admin.lab.algorithms import (
    find_trace_path,
    haversine_km,
    optimize_hypothesis_budget,
    optimize_project_place_route,
    schedule_validation_tasks,
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


def test_bfs_finds_the_shortest_trace_path() -> None:
    """Prueba el escenario: bfs finds the shortest trace path."""
    path, visited = find_trace_path("root", "goal", EDGES, "bfs")

    assert path == ["root", "b", "goal"]
    assert visited[0] == "root"


def test_dfs_explores_in_depth_and_records_visited_nodes() -> None:
    """Prueba el escenario: dfs explores in depth and registros visited nodes."""
    path, visited = find_trace_path("root", "goal", EDGES, "dfs")

    assert path[0] == "root"
    assert path[-1] == "goal"
    assert visited[0] == "root"
    # DFS recorre primero la rama "a" → expande "c" antes de llegar a "goal".
    assert visited.index("c") < visited.index("goal")


def test_search_returns_empty_path_when_target_is_unreachable() -> None:
    """Prueba el escenario: busqueda returns empty path when target is unreachable."""
    path, visited = find_trace_path("root", "unknown", EDGES, "bfs")

    assert path == []
    assert set(visited) == {"root", "a", "b", "c", "goal"}


def test_trace_search_rejects_unknown_algorithm() -> None:
    """Prueba el escenario: trace busqueda rejects desconocido algorithm."""
    # Abre y libera los recursos declarados en este bloque.
    with pytest.raises(ValueError, match="no soportado"):
        find_trace_path("root", "goal", EDGES, "ucs")


def test_haversine_distance_is_zero_for_same_point_and_matches_one_degree() -> None:
    """Prueba que Haversine da cero en el mismo punto y ~111 km por grado de latitud."""
    assert haversine_km(19.29, -99.65, 19.29, -99.65) == 0
    one_degree = haversine_km(19.29, -99.65, 20.29, -99.65)
    assert 110.5 < one_degree < 111.5


def test_haversine_distance_between_two_real_points_is_reasonable() -> None:
    """Prueba una distancia real: Zócalo de CDMX a centro de Toluca (~57 km en línea recta)."""
    distance = haversine_km(19.4326, -99.1332, 19.2826, -99.6557)
    assert 55 < distance < 60


def test_greedy_trace_reaches_the_target_using_node_kinds() -> None:
    """Prueba que la búsqueda voraz encuentra el objetivo usando la pista por tipo de nodo."""
    kinds = {
        "root": "project",
        "a": "attribute",
        "b": "source",
        "c": "finding",
        "goal": "competitor",
    }
    path, visited = find_trace_path("root", "goal", EDGES, "greedy", kinds)

    assert path[0] == "root"
    assert path[-1] == "goal"
    assert visited[0] == "root"


def test_astar_trace_returns_a_valid_path_and_matches_bfs_on_this_graph() -> None:
    """Prueba que A* devuelve un camino válido y, en este grafo, el mismo largo que BFS."""
    kinds = {
        "root": "project",
        "a": "attribute",
        "b": "source",
        "c": "finding",
        "goal": "competitor",
    }
    astar_path, _ = find_trace_path("root", "goal", EDGES, "astar", kinds)
    bfs_path, _ = find_trace_path("root", "goal", EDGES, "bfs")

    edges = set(EDGES)
    assert all(
        (left, right) in edges for left, right in zip(astar_path, astar_path[1:], strict=False)
    )
    assert len(astar_path) == len(bfs_path)


def test_astar_without_kinds_behaves_like_a_shortest_path_search() -> None:
    """Prueba que sin pista A* se comporta como búsqueda de camino más corto."""
    path, _ = find_trace_path("root", "goal", EDGES, "astar")

    assert path == ["root", "b", "goal"]


def test_nearest_neighbor_and_two_opt_visit_every_place_and_improve_each_other() -> None:
    """Prueba que el vecino más cercano visita todas las paradas y que 2-opt no empeora la ruta."""
    nearest = optimize_project_place_route(19.2850, -99.6550, PLACES, "nearest_neighbor", 1, 4, 1)
    two_opt = optimize_project_place_route(19.2850, -99.6550, PLACES, "two_opt", 1, 4, 1)

    for result in (nearest, two_opt):
        assert {p["place_id"] for p in result["ordered_places"]} == {"node:1", "node:2", "node:3"}
        assert result["total_distance_km"] >= result["optimal_reference_km"]
    assert two_opt["total_distance_km"] <= nearest["total_distance_km"] + 1e-9


def test_greedy_budget_respects_budget_and_matches_exact_on_this_example() -> None:
    """Prueba que la heurística voraz por valor/costo respeta el presupuesto y llega al óptimo."""
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "greedy_ratio")

    assert result["total_cost"] <= 700
    assert result["total_value"] == result["exact_reference_value"] == 130


def test_exact_route_matches_its_own_reference_and_visits_each_place() -> None:
    """Prueba el escenario: exacto ruta matches its own referencia and visits each lugar."""
    result = optimize_project_place_route(19.2850, -99.6550, PLACES, "exact", 42, 24, 30)

    assert result["total_distance_km"] == result["optimal_reference_km"]
    assert result["evaluations"] == 6
    ordered = [leg["place_id"] for leg in result["legs"]]
    assert ordered[:-1] == [leg["place_id"] for leg in result["legs"][:-1]]
    assert ordered[-1] == "project-location"
    assert {p["place_id"] for p in result["ordered_places"]} == {
        "node:1",
        "node:2",
        "node:3",
    }


def test_genetic_route_is_repeatable_for_the_same_seed() -> None:
    """Prueba el escenario: genetic ruta is repeatable para the same seed."""
    first = optimize_project_place_route(19.2850, -99.6550, PLACES, "genetic", 17, 12, 4)
    second = optimize_project_place_route(19.2850, -99.6550, PLACES, "genetic", 17, 12, 4)

    assert first["ordered_places"] == second["ordered_places"]
    assert first["history_km"] == second["history_km"]
    assert first["total_distance_km"] >= first["optimal_reference_km"]


def test_route_optimizer_rejects_out_of_bounds_groups() -> None:
    """Prueba el escenario: ruta optimizer rejects out of bounds groups."""
    # Abre y libera los recursos declarados en este bloque.
    with pytest.raises(ValueError, match="2 y 8"):
        optimize_project_place_route(19.28, -99.65, PLACES[:1], "exact", 42, 24, 30)
    # Abre y libera los recursos declarados en este bloque.
    with pytest.raises(ValueError, match="2 y 8"):
        optimize_project_place_route(19.28, -99.65, PLACES * 3, "exact", 42, 24, 30)


def test_budget_optimizer_picks_the_best_combination_under_budget() -> None:
    """Prueba el escenario: presupuesto optimizer picks the best combination under presupuesto."""
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "exact")

    assert result["selected_indices"] == [0, 1]
    assert result["total_cost"] == 700
    assert result["total_value"] == 130
    assert result["exact_reference_value"] == 130


def test_budget_hill_climbing_never_exceeds_budget_or_reference() -> None:
    """Prueba el escenario: presupuesto hill climbing never exceeds presupuesto or referencia."""
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "hill_climbing")

    assert result["total_cost"] <= 700
    assert result["total_value"] <= result["exact_reference_value"]


def test_schedule_respects_capacity_and_counts_satisfied_preferences() -> None:
    """Prueba el escenario: schedule respects capacity and counts satisfied preferences."""
    tasks = [
        {"id": f"t{i}", "statement": f"Hipótesis {i}", "priority": "high", "preferred_shift": s}
        for i, s in enumerate(["matutino", "matutino", "matutino", "vespertino"])
    ]

    result = schedule_validation_tasks(tasks, capacity_per_shift=2)

    assert len(result["assignments"]) == 4
    occupancy = {shift: result["assignments"].count(shift) for shift in set(result["assignments"])}
    assert max(occupancy.values()) <= 2
    assert result["satisfied_preferences"] <= 4
    assert result["priority_weighted_score"] >= 0
