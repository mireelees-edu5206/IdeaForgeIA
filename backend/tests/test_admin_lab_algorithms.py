import pytest

from app.modules.admin.lab.algorithms import (
    euclidean_distance_km,
    find_trace_path,
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
    path, visited = find_trace_path("root", "goal", EDGES, "bfs")

    assert path == ["root", "b", "goal"]
    assert visited[0] == "root"


def test_dfs_explores_in_depth_and_records_visited_nodes() -> None:
    path, visited = find_trace_path("root", "goal", EDGES, "dfs")

    assert path[0] == "root"
    assert path[-1] == "goal"
    assert visited[0] == "root"
    # DFS recorre primero la rama "a" → expande "c" antes de llegar a "goal".
    assert visited.index("c") < visited.index("goal")


def test_search_returns_empty_path_when_target_is_unreachable() -> None:
    path, visited = find_trace_path("root", "unknown", EDGES, "bfs")

    assert path == []
    assert set(visited) == {"root", "a", "b", "c", "goal"}


def test_trace_search_rejects_unknown_algorithm() -> None:
    with pytest.raises(ValueError, match="no soportado"):
        find_trace_path("root", "goal", EDGES, "ucs")


def test_euclidean_distance_is_zero_for_same_point_and_scales_with_degrees() -> None:
    assert euclidean_distance_km(19.29, -99.65, 19.29, -99.65) == 0
    one_degree = euclidean_distance_km(19.29, -99.65, 20.29, -99.65)
    assert 110 < one_degree < 112


def test_exact_route_matches_its_own_reference_and_visits_each_place() -> None:
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
    first = optimize_project_place_route(19.2850, -99.6550, PLACES, "genetic", 17, 12, 4)
    second = optimize_project_place_route(19.2850, -99.6550, PLACES, "genetic", 17, 12, 4)

    assert first["ordered_places"] == second["ordered_places"]
    assert first["history_km"] == second["history_km"]
    assert first["total_distance_km"] >= first["optimal_reference_km"]


def test_route_optimizer_rejects_out_of_bounds_groups() -> None:
    with pytest.raises(ValueError, match="2 y 8"):
        optimize_project_place_route(19.28, -99.65, PLACES[:1], "exact", 42, 24, 30)
    with pytest.raises(ValueError, match="2 y 8"):
        optimize_project_place_route(19.28, -99.65, PLACES * 3, "exact", 42, 24, 30)


def test_budget_optimizer_picks_the_best_combination_under_budget() -> None:
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "exact")

    assert result["selected_indices"] == [0, 1]
    assert result["total_cost"] == 700
    assert result["total_value"] == 130
    assert result["exact_reference_value"] == 130


def test_budget_hill_climbing_never_exceeds_budget_or_reference() -> None:
    result = optimize_hypothesis_budget(HYPOTHESES, 700, "hill_climbing")

    assert result["total_cost"] <= 700
    assert result["total_value"] <= result["exact_reference_value"]


def test_schedule_respects_capacity_and_counts_satisfied_preferences() -> None:
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
