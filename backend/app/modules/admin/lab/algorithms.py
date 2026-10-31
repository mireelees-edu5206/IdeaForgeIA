"""Implementa BFS/DFS, rutas, busqueda local y genetica."""

import heapq
import itertools
import math
import random
from collections import deque
from collections.abc import Mapping, Sequence
from itertools import permutations
from typing import Any

_EARTH_RADIUS_KM = 6371.0088
_SHIFTS = ("matutino", "vespertino", "nocturno")
_PRIORITY_WEIGHT = {"low": 1, "medium": 2, "high": 3}


# Nivel de cada tipo de elemento en la cadena de IdeaForge: 0 es la idea y 5 es un competidor.
# La heurística usa esta diferencia de niveles como pista para decidir qué revisar primero.
_KIND_RANK: dict[str, int] = {
    "project": 0,
    "attribute": 1,
    "research_run": 1,
    "report": 1,
    "query": 2,
    "report_section": 2,
    "source": 3,
    "finding": 3,
    "opportunity": 3,
    "risk": 3,
    "hypothesis": 3,
    "missing_information": 3,
    "evidence": 4,
    "entity": 4,
    "competitor": 5,
}


def _kind_heuristic(node_id: str, target_id: str, node_kinds: Mapping[str, str] | None) -> int:
    """Heurística: cuántos niveles separan el nodo del objetivo. Es una pista, no medida exacta."""
    if not node_kinds:
        return 0
    node_rank = _KIND_RANK.get(node_kinds.get(node_id, ""), 3)
    target_rank = _KIND_RANK.get(node_kinds.get(target_id, ""), 3)
    return abs(node_rank - target_rank)


def find_trace_path(
    root_id: str,
    target_id: str,
    edges: Sequence[tuple[str, str]],
    algorithm: str,
    node_kinds: Mapping[str, str] | None = None,
) -> tuple[list[str], list[str]]:
    """Busca un camino en el grafo de trazabilidad.

    - ``bfs`` y ``dfs``: búsquedas ciegas; no usan ninguna pista sobre el objetivo.
    - ``greedy``: búsqueda con heurística voraz; siempre revisa primero el nodo que la pista
      considera más cercano. Es rápida, pero no garantiza el camino más corto.
    - ``astar``: A*; combina el número de pasos recorridos con la pista. Puede encontrar el
      camino más corto, pero la pista no lo asegura; por eso el servicio compara con BFS.
    """
    adjacency: dict[str, list[str]] = {}
    # Itera (source, target) sobre edges.
    for source, target in edges:
        adjacency.setdefault(source, []).append(target)

    expanded: list[str] = []
    # Rama condicional: se cumple algorithm == 'bfs'.
    if algorithm == "bfs":
        frontier = deque([(root_id, [root_id])])
        discovered = {root_id}
        # Repite el bloque mientras frontier.
        while frontier:
            node_id, path = frontier.popleft()
            expanded.append(node_id)
            # Rama condicional: se cumple node_id == target_id.
            if node_id == target_id:
                return path, expanded
            # Itera neighbor sobre adjacency.get(node_id, []).
            for neighbor in adjacency.get(node_id, []):
                # Rama condicional: se cumple neighbor not in discovered.
                if neighbor not in discovered:
                    discovered.add(neighbor)
                    frontier.append((neighbor, [*path, neighbor]))
        return [], expanded

    # Rama condicional: se cumple algorithm == 'dfs'.
    if algorithm == "dfs":
        frontier = [(root_id, [root_id])]
        discovered: set[str] = set()
        # Repite el bloque mientras frontier.
        while frontier:
            node_id, path = frontier.pop()
            # Rama condicional: se cumple node_id in discovered.
            if node_id in discovered:
                continue
            discovered.add(node_id)
            expanded.append(node_id)
            # Rama condicional: se cumple node_id == target_id.
            if node_id == target_id:
                return path, expanded
            # Itera neighbor sobre reversed(adjacency.get(node_id, [])).
            for neighbor in reversed(adjacency.get(node_id, [])):
                # Rama condicional: se cumple neighbor not in discovered.
                if neighbor not in discovered:
                    frontier.append((neighbor, [*path, neighbor]))
        return [], expanded

    if algorithm == "greedy":
        # La cola ordena por la pista: el nodo que parece más cercano al objetivo sale primero.
        # El contador evita comparar listas de caminos cuando dos nodos tienen la misma pista.
        counter = itertools.count()
        queue: list[tuple[int, int, str, list[str]]] = [
            (_kind_heuristic(root_id, target_id, node_kinds), next(counter), root_id, [root_id])
        ]
        discovered_greedy = {root_id}
        while queue:
            _, _, node_id, path = heapq.heappop(queue)
            expanded.append(node_id)
            if node_id == target_id:
                return path, expanded
            for neighbor in adjacency.get(node_id, []):
                if neighbor not in discovered_greedy:
                    discovered_greedy.add(neighbor)
                    estimate = _kind_heuristic(neighbor, target_id, node_kinds)
                    heapq.heappush(queue, (estimate, next(counter), neighbor, [*path, neighbor]))
        return [], expanded

    if algorithm == "astar":
        # A*: prioridad = pasos recorridos (g) + pista hasta el objetivo (h).
        # best_steps guarda la mejor distancia conocida a cada nodo para no repetir trabajo.
        counter = itertools.count()
        best_steps: dict[str, int] = {root_id: 0}
        astar_queue: list[tuple[int, int, int, str, list[str]]] = [
            (_kind_heuristic(root_id, target_id, node_kinds), 0, next(counter), root_id, [root_id])
        ]
        while astar_queue:
            _, steps, _, node_id, path = heapq.heappop(astar_queue)
            if steps > best_steps.get(node_id, steps):
                continue
            expanded.append(node_id)
            if node_id == target_id:
                return path, expanded
            for neighbor in adjacency.get(node_id, []):
                next_steps = steps + 1
                if next_steps < best_steps.get(neighbor, math.inf):
                    best_steps[neighbor] = next_steps
                    estimate = _kind_heuristic(neighbor, target_id, node_kinds)
                    heapq.heappush(
                        astar_queue,
                        (
                            next_steps + estimate,
                            next_steps,
                            next(counter),
                            neighbor,
                            [*path, neighbor],
                        ),
                    )
        return [], expanded

    raise ValueError("Algoritmo de trazabilidad no soportado.")


def haversine_km(
    origin_latitude: float,
    origin_longitude: float,
    target_latitude: float,
    target_longitude: float,
) -> float:
    """Distancia en línea recta sobre la superficie de la Tierra (fórmula de Haversine).

    Usa la curvatura real del planeta, así que es más precisa que tratar el mapa como plano.
    No es la distancia por calles: una calle siempre es igual o más larga que esta línea.
    """
    phi_origin = math.radians(origin_latitude)
    phi_target = math.radians(target_latitude)
    delta_phi = phi_target - phi_origin
    delta_lambda = math.radians(target_longitude - origin_longitude)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_origin) * math.cos(phi_target) * math.sin(delta_lambda / 2) ** 2
    )
    # min(1.0, ...) evita errores de redondeo que harían fallar a asin cuando a casi vale 1.
    return 2 * _EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def optimize_project_place_route(
    latitude: float,
    longitude: float,
    places: Sequence[dict[str, Any]],
    algorithm: str,
    seed: int,
    population_size: int,
    generations: int,
) -> dict[str, Any]:
    """Ordena lugares reales para reducir la distancia de ida y vuelta del proyecto."""
    # Rama condicional: se cumple not 2 <= len(places) <= 8.
    if not 2 <= len(places) <= 8:
        raise ValueError("Selecciona entre 2 y 8 lugares reales del proyecto.")

    def distance(route: list[int]) -> float:
        """Gestiona el flujo en laboratorio admin."""
        coords = (
            [(latitude, longitude)]
            + [
                (float(places[index]["latitude"]), float(places[index]["longitude"]))
                for index in route
            ]
            + [(latitude, longitude)]
        )
        return sum(haversine_km(*left, *right) for left, right in itertools.pairwise(coords))

    indices = list(range(len(places)))
    evaluations = 0
    history: list[float] = []

    def exact() -> tuple[list[int], float, int]:
        """Gestiona el flujo en laboratorio admin."""
        best_route: list[int] = []
        best_distance = math.inf
        exact_evaluations = 0
        # Itera candidate sobre permutations(indices).
        for candidate in permutations(indices):
            candidate_list = list(candidate)
            candidate_distance = distance(candidate_list)
            exact_evaluations += 1
            # Rama condicional: se cumple candidate_distance < best_distance.
            if candidate_distance < best_distance:
                best_route, best_distance = candidate_list, candidate_distance
        return best_route, best_distance, exact_evaluations

    def nearest_neighbor() -> list[int]:
        """Heurística del vecino más cercano: siempre pasa a la parada más próxima pendiente."""
        nonlocal evaluations
        pending = list(indices)
        order: list[int] = []
        current = (latitude, longitude)
        while pending:
            next_index = min(
                pending,
                key=lambda index: haversine_km(
                    *current, float(places[index]["latitude"]), float(places[index]["longitude"])
                ),
            )
            evaluations += len(pending)
            order.append(next_index)
            pending.remove(next_index)
            current = (
                float(places[next_index]["latitude"]),
                float(places[next_index]["longitude"]),
            )
        return order

    # Rama condicional: se cumple algorithm == 'exact'.
    if algorithm == "exact":
        route, total_distance, evaluations = exact()
        history = [round(total_distance, 3)]
        optimal_distance = total_distance
    # Rama condicional: se cumple algorithm == 'hill_climbing'.
    elif algorithm == "hill_climbing":
        rng = random.Random(seed)
        route = indices.copy()
        rng.shuffle(route)
        total_distance = distance(route)
        evaluations = 1
        history = [round(total_distance, 3)]
        # Cada vecino intercambia dos paradas y solo se conserva si mejora la distancia.
        while True:
            best_route: list[int] | None = None
            best_distance = total_distance
            # Itera left sobre range(len(route)).
            for left in range(len(route)):
                # Itera right sobre range(left + 1, len(route)).
                for right in range(left + 1, len(route)):
                    candidate = route.copy()
                    candidate[left], candidate[right] = candidate[right], candidate[left]
                    candidate_distance = distance(candidate)
                    evaluations += 1
                    # Rama condicional: se cumple candidate_distance < best_distance - 1e-09.
                    if candidate_distance < best_distance - 1e-9:
                        best_route, best_distance = candidate, candidate_distance
            # Rama condicional: se cumple best_route is None.
            if best_route is None:
                break
            route, total_distance = best_route, best_distance
            history.append(round(total_distance, 3))
        _, optimal_distance, _ = exact()
    # Rama condicional: se cumple algorithm == 'genetic'.
    elif algorithm == "nearest_neighbor":
        route = nearest_neighbor()
        total_distance = distance(route)
        evaluations += 1
        history = [round(total_distance, 3)]
        _, optimal_distance, _ = exact()
    elif algorithm == "two_opt":
        # 2-opt parte de la ruta del vecino más cercano y prueba invertir cada tramo.
        # Si invertir un tramo acorta la ruta, se conserva. Se repite hasta que ya no mejore.
        route = nearest_neighbor()
        total_distance = distance(route)
        evaluations += 1
        history = [round(total_distance, 3)]
        improved = True
        while improved:
            improved = False
            for left in range(len(route) - 1):
                for right in range(left + 1, len(route)):
                    candidate = route[:left] + route[left : right + 1][::-1] + route[right + 1 :]
                    candidate_distance = distance(candidate)
                    evaluations += 1
                    if candidate_distance < total_distance - 1e-9:
                        route, total_distance = candidate, candidate_distance
                        history.append(round(total_distance, 3))
                        improved = True
        _, optimal_distance, _ = exact()
    elif algorithm == "genetic":
        rng = random.Random(seed)

        def evaluate(candidate: list[int]) -> float:
            """Gestiona el flujo en laboratorio admin."""
            nonlocal evaluations
            evaluations += 1
            return distance(candidate)

        # La población combina segmentos de rutas y aplica intercambios aleatorios.
        population = [rng.sample(indices, len(indices)) for _ in range(population_size)]
        # Itera _ sobre range(generations).
        for _ in range(generations):
            population.sort(key=evaluate)
            history.append(round(evaluate(population[0]), 3))
            next_population = population[:2]
            # Repite el bloque mientras len(next_population) < population_size.
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
                # Itera gene sobre remaining.
                for gene in remaining:
                    child[cursor] = gene
                    cursor = (cursor + 1) % len(indices)
                offspring = [gene for gene in child if gene is not None]
                # Rama condicional: se cumple rng.random() < 0.15.
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
    # Itera place sobre ordered_places.
    for place in ordered_places:
        current = (float(place["latitude"]), float(place["longitude"]))
        legs.append(
            {
                "place_id": place["place_id"],
                "name": place["name"],
                "distance_from_previous_km": round(haversine_km(*previous, *current), 3),
            }
        )
        previous = current
    legs.append(
        {
            "place_id": "project-location",
            "name": "Regreso al punto de partida",
            "distance_from_previous_km": round(haversine_km(*previous, latitude, longitude), 3),
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
    """Selecciona hipótesis bajo un tope de costo.

    ``expected_value`` solo ordena opciones propuestas, no predice resultados reales.
    """

    def score(indices: frozenset[int]) -> tuple[int, int]:
        """Calcula el flujo en laboratorio admin."""
        cost = sum(int(items[index]["estimated_cost"]) for index in indices)
        value = sum(int(items[index]["expected_value"]) for index in indices)
        return (value if cost <= budget else -1), cost

    evaluations = 0
    # Rama condicional: se cumple algorithm == 'exact'.
    if algorithm == "exact":
        best_set: frozenset[int] = frozenset()
        best_value, best_cost = -1, 0
        # Recorre todas las combinaciones posibles; se reserva para listas pequeñas.
        for mask in range(1 << len(items)):
            selection = frozenset(i for i in range(len(items)) if mask & (1 << i))
            value, cost = score(selection)
            evaluations += 1
            # Rama condicional: se cumple value > best_value.
            if value > best_value:
                best_set, best_value, best_cost = selection, value, cost
    # Rama condicional: se cumple algorithm == 'hill_climbing'.
    elif algorithm == "hill_climbing":
        current: frozenset[int] = frozenset()
        current_value, current_cost = score(current)
        evaluations = 1
        # Repite el bloque mientras True.
        while True:
            best_neighbor: frozenset[int] | None = None
            best_value, best_cost = current_value, current_cost
            # Itera index sobre range(len(items)).
            for index in range(len(items)):
                neighbor = current ^ {index}
                value, cost = score(neighbor)
                evaluations += 1
                # Rama condicional: se cumple value > best_value.
                if value > best_value:
                    best_neighbor, best_value, best_cost = neighbor, value, cost
            # Rama condicional: se cumple best_neighbor is None.
            if best_neighbor is None:
                break
            current, current_value, current_cost = best_neighbor, best_value, best_cost
        best_set, best_value, best_cost = current, current_value, current_cost
    elif algorithm == "greedy_ratio":
        # Heurística voraz: ordena por valor esperado por cada peso de costo y toma lo que quepa.
        # Un costo de 0 se considera la mejor opción posible (valor infinito por costo).
        def ratio(index: int) -> float:
            """Valor esperado por cada unidad de costo de una hipótesis."""
            cost = int(items[index]["estimated_cost"])
            value = int(items[index]["expected_value"])
            return value / cost if cost else math.inf

        selected: frozenset[int] = frozenset()
        spent = 0
        evaluations = len(items)
        for index in sorted(range(len(items)), key=ratio, reverse=True):
            cost = int(items[index]["estimated_cost"])
            if spent + cost <= budget:
                selected = selected | {index}
                spent += cost
        best_set = selected
        best_value, best_cost = score(selected)
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
    """Gestiona validation tasks en laboratorio admin."""
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
        """Calcula el flujo en laboratorio admin."""
        return sum(
            priority_weight[task["priority"]]
            for task, shift in zip(tasks, candidate, strict=True)
            if task["preferred_shift"] == shift
        )

    evaluations = 1
    current_score = score(assignments)
    # Repite el bloque mientras True.
    while True:
        best: list[str] | None = None
        best_score = current_score
        # Itera index sobre range(len(tasks)).
        for index in range(len(tasks)):
            source = assignments[index]
            # Itera shift sobre shifts.
            for shift in shifts:
                # Rama condicional: se cumple shift == source.
                if shift == source:
                    continue
                # Rama condicional: se cumple occupancy[shift] >= capacity_per_shift.
                if occupancy[shift] >= capacity_per_shift:
                    continue
                candidate = assignments.copy()
                candidate[index] = shift
                candidate_score = score(candidate)
                evaluations += 1
                # Rama condicional: se cumple candidate_score > best_score.
                if candidate_score > best_score:
                    best, best_score = candidate, candidate_score
        # Rama condicional: se cumple best is None.
        if best is None:
            break
        old_assignments = assignments
        assignments = best
        occupancy = dict.fromkeys(shifts, 0)
        # Itera shift sobre assignments.
        for shift in assignments:
            occupancy[shift] += 1
        current_score = best_score
        # Rama condicional: se cumple assignments == old_assignments.
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
