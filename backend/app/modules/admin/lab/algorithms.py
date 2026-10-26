import itertools
import math
import random
from collections import deque
from collections.abc import Sequence
from itertools import permutations
from typing import Any

_EARTH_RADIUS_KM = 6371.0088
_SHIFTS = ("matutino", "vespertino", "nocturno")
_PRIORITY_WEIGHT = {"low": 1, "medium": 2, "high": 3}


def find_trace_path(
    root_id: str,
    target_id: str,
    edges: Sequence[tuple[str, str]],
    algorithm: str,
) -> tuple[list[str], list[str]]:
    adjacency: dict[str, list[str]] = {}
    for source, target in edges:
        adjacency.setdefault(source, []).append(target)

    expanded: list[str] = []
    if algorithm == "bfs":
        frontier = deque([(root_id, [root_id])])
        discovered = {root_id}
        while frontier:
            node_id, path = frontier.popleft()
            expanded.append(node_id)
            if node_id == target_id:
                return path, expanded
            for neighbor in adjacency.get(node_id, []):
                if neighbor not in discovered:
                    discovered.add(neighbor)
                    frontier.append((neighbor, [*path, neighbor]))
        return [], expanded

    if algorithm == "dfs":
        frontier = [(root_id, [root_id])]
        discovered: set[str] = set()
        while frontier:
            node_id, path = frontier.pop()
            if node_id in discovered:
                continue
            discovered.add(node_id)
            expanded.append(node_id)
            if node_id == target_id:
                return path, expanded
            for neighbor in reversed(adjacency.get(node_id, [])):
                if neighbor not in discovered:
                    frontier.append((neighbor, [*path, neighbor]))
        return [], expanded

    raise ValueError("Algoritmo de trazabilidad no soportado.")


def euclidean_distance_km(
    origin_latitude: float,
    origin_longitude: float,
    target_latitude: float,
    target_longitude: float,
) -> float:
    mean_latitude = math.radians((origin_latitude + target_latitude) / 2)
    delta_east = math.radians(target_longitude - origin_longitude) * math.cos(mean_latitude)
    delta_north = math.radians(target_latitude - origin_latitude)
    east_km = _EARTH_RADIUS_KM * delta_east
    north_km = _EARTH_RADIUS_KM * delta_north
    return math.hypot(east_km, north_km)


def optimize_project_place_route(
    latitude: float,
    longitude: float,
    places: Sequence[dict[str, Any]],
    algorithm: str,
    seed: int,
    population_size: int,
    generations: int,
) -> dict[str, Any]:
    if not 2 <= len(places) <= 8:
        raise ValueError("Selecciona entre 2 y 8 lugares reales del proyecto.")

    def distance(route: list[int]) -> float:
        coords = (
            [(latitude, longitude)]
            + [
                (float(places[index]["latitude"]), float(places[index]["longitude"]))
                for index in route
            ]
            + [(latitude, longitude)]
        )
        return sum(
            euclidean_distance_km(*left, *right) for left, right in itertools.pairwise(coords)
        )

    indices = list(range(len(places)))
    evaluations = 0
    history: list[float] = []

    def exact() -> tuple[list[int], float, int]:
        best_route: list[int] = []
        best_distance = math.inf
        exact_evaluations = 0
        for candidate in permutations(indices):
            candidate_list = list(candidate)
            candidate_distance = distance(candidate_list)
            exact_evaluations += 1
            if candidate_distance < best_distance:
                best_route, best_distance = candidate_list, candidate_distance
        return best_route, best_distance, exact_evaluations

    if algorithm == "exact":
        route, total_distance, evaluations = exact()
        history = [round(total_distance, 3)]
        optimal_distance = total_distance
    elif algorithm == "hill_climbing":
        rng = random.Random(seed)
        route = indices.copy()
        rng.shuffle(route)
        total_distance = distance(route)
        evaluations = 1
        history = [round(total_distance, 3)]
        while True:
            best_route: list[int] | None = None
            best_distance = total_distance
            for left in range(len(route)):
                for right in range(left + 1, len(route)):
                    candidate = route.copy()
                    candidate[left], candidate[right] = candidate[right], candidate[left]
                    candidate_distance = distance(candidate)
                    evaluations += 1
                    if candidate_distance < best_distance - 1e-9:
                        best_route, best_distance = candidate, candidate_distance
            if best_route is None:
                break
            route, total_distance = best_route, best_distance
            history.append(round(total_distance, 3))
        _, optimal_distance, _ = exact()
    elif algorithm == "genetic":
        rng = random.Random(seed)

        def evaluate(candidate: list[int]) -> float:
            nonlocal evaluations
            evaluations += 1
            return distance(candidate)

        population = [rng.sample(indices, len(indices)) for _ in range(population_size)]
        for _ in range(generations):
            population.sort(key=evaluate)
            history.append(round(evaluate(population[0]), 3))
            next_population = population[:2]
            while len(next_population) < population_size:
                candidates = rng.sample(population, min(3, len(population)))
                parent_a = min(candidates, key=evaluate)
                candidates = rng.sample(population, min(3, len(population)))
                parent_b = min(candidates, key=evaluate)
                left, right = sorted(rng.sample(range(len(indices)), 2))
                child: list[int | None] = [None] * len(indices)
                child[left : right + 1] = parent_a[left : right + 1]
                remaining = [gene for gene in parent_b if gene not in child]
                cursor = (right + 1) % len(indices)
                for gene in remaining:
                    child[cursor] = gene
                    cursor = (cursor + 1) % len(indices)
                offspring = [gene for gene in child if gene is not None]
                if rng.random() < 0.15:
                    a, b = rng.sample(range(len(offspring)), 2)
                    offspring[a], offspring[b] = offspring[b], offspring[a]
                next_population.append(offspring)
            population = next_population
        population.sort(key=evaluate)
        route = population[0]
        total_distance = distance(route)
        _, optimal_distance, _ = exact()
    else:
        raise ValueError("Algoritmo de ruta no soportado.")

    ordered_places = [places[index] for index in route]
    legs = []
    previous = (latitude, longitude)
    for place in ordered_places:
        current = (float(place["latitude"]), float(place["longitude"]))
        legs.append(
            {
                "place_id": place["place_id"],
                "name": place["name"],
                "distance_from_previous_km": round(euclidean_distance_km(*previous, *current), 3),
            }
        )
        previous = current
    legs.append(
        {
            "place_id": "project-location",
            "name": "Regreso al punto de partida",
            "distance_from_previous_km": round(
                euclidean_distance_km(*previous, latitude, longitude), 3
            ),
        }
    )
    return {
        "ordered_places": ordered_places,
        "legs": legs,
        "total_distance_km": round(total_distance, 3),
        "optimal_reference_km": round(optimal_distance, 3),
        "evaluations": evaluations,
        "history_km": history,
    }


def optimize_hypothesis_budget(
    items: Sequence[dict[str, Any]], budget: int, algorithm: str
) -> dict[str, Any]:
    def score(indices: frozenset[int]) -> tuple[int, int]:
        cost = sum(int(items[index]["estimated_cost"]) for index in indices)
        value = sum(int(items[index]["expected_value"]) for index in indices)
        return (value if cost <= budget else -1), cost

    evaluations = 0
    if algorithm == "exact":
        best_set: frozenset[int] = frozenset()
        best_value, best_cost = -1, 0
        for mask in range(1 << len(items)):
            selection = frozenset(i for i in range(len(items)) if mask & (1 << i))
            value, cost = score(selection)
            evaluations += 1
            if value > best_value:
                best_set, best_value, best_cost = selection, value, cost
    elif algorithm == "hill_climbing":
        current: frozenset[int] = frozenset()
        current_value, current_cost = score(current)
        evaluations = 1
        while True:
            best_neighbor: frozenset[int] | None = None
            best_value, best_cost = current_value, current_cost
            for index in range(len(items)):
                neighbor = current ^ {index}
                value, cost = score(neighbor)
                evaluations += 1
                if value > best_value:
                    best_neighbor, best_value, best_cost = neighbor, value, cost
            if best_neighbor is None:
                break
            current, current_value, current_cost = best_neighbor, best_value, best_cost
        best_set, best_value, best_cost = current, current_value, current_cost
    else:
        raise ValueError("Algoritmo de presupuesto no soportado.")

    optimal_value = max(
        score(frozenset(i for i in range(len(items)) if mask & (1 << i)))[0]
        for mask in range(1 << len(items))
    )
    return {
        "selected_indices": sorted(best_set),
        "total_cost": best_cost,
        "total_value": best_value,
        "exact_reference_value": optimal_value,
        "evaluations": evaluations,
    }


def schedule_validation_tasks(
    tasks: Sequence[dict[str, Any]], capacity_per_shift: int
) -> dict[str, Any]:
    shifts = ("matutino", "vespertino", "nocturno")
    priority_weight = {"low": 1, "medium": 2, "high": 3}
    assignments: list[str] = []
    occupancy = dict.fromkeys(shifts, 0)

    # Inicio balanceado: reparte las tareas reales antes de optimizar preferencias/capacidad.
    for task in tasks:
        preferred = task["preferred_shift"]
        candidates = [shift for shift in shifts if occupancy[shift] < capacity_per_shift]
        shift = preferred if preferred in candidates else min(candidates, key=occupancy.get)
        assignments.append(shift)
        occupancy[shift] += 1

    def score(candidate: Sequence[str]) -> int:
        return sum(
            priority_weight[task["priority"]]
            for task, shift in zip(tasks, candidate, strict=True)
            if task["preferred_shift"] == shift
        )

    evaluations = 1
    current_score = score(assignments)
    while True:
        best: list[str] | None = None
        best_score = current_score
        for index in range(len(tasks)):
            source = assignments[index]
            for shift in shifts:
                if shift == source:
                    continue
                if occupancy[shift] >= capacity_per_shift:
                    continue
                candidate = assignments.copy()
                candidate[index] = shift
                candidate_score = score(candidate)
                evaluations += 1
                if candidate_score > best_score:
                    best, best_score = candidate, candidate_score
        if best is None:
            break
        old_assignments = assignments
        assignments = best
        occupancy = dict.fromkeys(shifts, 0)
        for shift in assignments:
            occupancy[shift] += 1
        current_score = best_score
        if assignments == old_assignments:
            break

    return {
        "assignments": assignments,
        "satisfied_preferences": sum(
            task["preferred_shift"] == shift for task, shift in zip(tasks, assignments, strict=True)
        ),
        "priority_weighted_score": current_score,
        "evaluations": evaluations,
    }
