"""Algoritmos del laboratorio administrativo: búsqueda BFS, rutas y selección con presupuesto.

Este archivo no conoce la base de datos ni HTTP. Recibe datos ya preparados (listas y números) y
devuelve resultados. Por eso se puede probar sola, sin levantar el servidor.

Los tres grupos de algoritmos son:
1. Trazabilidad: BFS busca el camino con menos pasos en el grafo de relaciones del proyecto.
2. Rutas: ordena lugares reales para visitarlos y volver al punto de partida.
3. Presupuesto: elige hipótesis que quepan en un tope de dinero.
"""

import itertools
import math
from collections import deque
from collections.abc import Sequence
from itertools import permutations
from typing import Any

# Radio medio de la Tierra en kilómetros. Se usa para convertir ángulos en distancias.
_EARTH_RADIUS_KM = 6371.0088


def find_trace_path(
    root_id: str,
    target_id: str,
    edges: Sequence[tuple[str, str]],
) -> tuple[list[str], list[str]]:
    """Busca el camino con menos pasos en el grafo de trazabilidad (búsqueda en anchura, BFS).

    Qué mide: el número de conexiones (pasos) desde la raíz hasta el objetivo.
    Qué devuelve: el camino (lista de ids) y el orden en que se revisaron los nodos.
    Garantía: si existe un camino, BFS siempre devuelve uno con el mínimo número de pasos,
    porque revisa todos los nodos a 1 paso antes que los de 2, y así sucesivamente.
    Costo: cada nodo y cada conexión se revisan una vez, así que el tiempo es proporcional al
    número de nodos más el número de conexiones.
    No usa ninguna pista sobre el objetivo (por eso se llama "búsqueda ciega").
    """
    # Convierte la lista de conexiones en un diccionario: nodo -> lista de vecinos que salen de él.
    adjacency: dict[str, list[str]] = {}
    # Itera (source, target) sobre edges.
    for source, target in edges:
        adjacency.setdefault(source, []).append(target)

    # "expanded" guarda el orden en que BFS saca nodos de la cola: muestra cuánto trabajó.
    expanded: list[str] = []
    # La cola guarda pares (nodo, camino hasta ese nodo). Empieza con la raíz.
    frontier = deque([(root_id, [root_id])])
    # "discovered" recuerda los nodos ya metidos a la cola, para no repetirlos (evita ciclos).
    discovered = {root_id}
    # Repite el bloque mientras frontier.
    while frontier:
        # popleft saca el primer elemento de la cola: esto es lo que hace que BFS sea por capas.
        node_id, path = frontier.popleft()
        expanded.append(node_id)
        # Rama condicional: se cumple node_id == target_id.
        # Como BFS avanza por capas, el primer destino encontrado está a la menor distancia.
        if node_id == target_id:
            return path, expanded
        # Itera neighbor sobre adjacency.get(node_id, []).
        for neighbor in adjacency.get(node_id, []):
            # Rama condicional: se cumple neighbor not in discovered.
            # Si el vecino ya fue descubierto, otro camino más corto (o igual) ya lo alcanzó.
            if neighbor not in discovered:
                discovered.add(neighbor)
                # Se guarda el camino completo, copiando la lista, para no alterar caminos previos.
                frontier.append((neighbor, [*path, neighbor]))
    # La cola se vació sin llegar al objetivo: no hay camino desde la raíz.
    return [], expanded


def haversine_km(
    origin_latitude: float,
    origin_longitude: float,
    target_latitude: float,
    target_longitude: float,
) -> float:
    """Distancia en línea recta sobre la superficie de la Tierra (fórmula de Haversine).

    Qué mide: la distancia más corta entre dos puntos sobre una esfera, en kilómetros.
    Por qué no la distancia plana: un grado de longitud mide menos kilómetros que un grado de
    latitud (a ~19° de latitud, ~105 km contra ~110.6 km). Tratar las coordenadas como plano
    deforma las distancias. Haversine corrige eso.
    Límite: es la línea recta, no la distancia por calles. Una calle siempre es igual o más larga.
    Costo: unas pocas operaciones trigonométricas, tiempo constante.
    """
    # Las funciones trigonométricas de Python trabajan en radianes, no en grados.
    phi_origin = math.radians(origin_latitude)
    phi_target = math.radians(target_latitude)
    delta_phi = phi_target - phi_origin
    delta_lambda = math.radians(target_longitude - origin_longitude)
    # "a" es el cuadrado de la mitad de la cuerda entre los dos puntos sobre la esfera.
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_origin) * math.cos(phi_target) * math.sin(delta_lambda / 2) ** 2
    )
    # min(1.0, ...) evita errores de redondeo que harían fallar a asin cuando a casi vale 1.
    # 2 * R * asin(...) convierte el ángulo central en una longitud de arco.
    return 2 * _EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(a)))


def optimize_project_place_route(
    latitude: float,
    longitude: float,
    places: Sequence[dict[str, Any]],
    algorithm: str,
) -> dict[str, Any]:
    """Ordena lugares reales para reducir la distancia de ida y vuelta del proyecto.

    Qué mide: la suma de distancias Haversine del punto de partida, por cada parada en orden, y
    de regreso al punto de partida. Este problema se llama "del agente viajero" (TSP).

    Métodos disponibles:
    - ``exact``: prueba todos los órdenes posibles y se queda con el más corto.
      Garantía: siempre da el óptimo. Costo: n! órdenes; con 8 paradas son 40 320, rápido.
    - ``nearest_neighbor``: siempre va a la parada más cercana que todavía falta.
      Garantía: ninguna; suele quedar lejos del óptimo en rutas con mucho zigzag.
      Costo: aproximadamente n²/2 comparaciones, muy barato.

    Siempre se calcula el óptimo exacto como referencia, para que el resultado muestre cuánto
    se aleja el método elegido de la mejor ruta posible.
    """
    # Rama condicional: se cumple not 2 <= len(places) <= 8.
    # El límite de 8 existe porque el método exacto crece como n!: con 9 paradas ya son 362 880.
    if not 2 <= len(places) <= 8:
        raise ValueError("Selecciona entre 2 y 8 lugares reales del proyecto.")

    def distance(route: list[int]) -> float:
        """Distancia total de ida y vuelta siguiendo el orden indicado (en km)."""
        # La lista de puntos: inicio, cada parada en el orden dado, y otra vez el inicio.
        coords = (
            [(latitude, longitude)]
            + [
                (float(places[index]["latitude"]), float(places[index]["longitude"]))
                for index in route
            ]
            + [(latitude, longitude)]
        )
        # pairwise da pares consecutivos: (inicio, parada1), (parada1, parada2), ...
        return sum(haversine_km(*left, *right) for left, right in itertools.pairwise(coords))

    # Índices de los lugares: 0, 1, 2, ... Trabajar con índices es más simple que con los lugares.
    indices = list(range(len(places)))

    def exact() -> tuple[list[int], float]:
        """Revisa todos los órdenes y conserva el más corto (fuerza bruta)."""
        best_route: list[int] = []
        best_distance = math.inf
        # Itera candidate sobre permutations(indices): genera cada orden posible una sola vez.
        for candidate in permutations(indices):
            candidate_list = list(candidate)
            candidate_distance = distance(candidate_list)
            # Rama condicional: se cumple candidate_distance < best_distance.
            if candidate_distance < best_distance:
                best_route, best_distance = candidate_list, candidate_distance
        return best_route, best_distance

    def nearest_neighbor() -> list[int]:
        """Heurística del vecino más cercano: siempre pasa a la parada más próxima pendiente."""
        # "pending" son las paradas que todavía no se visitan; "order" es la ruta que se construye.
        pending = list(indices)
        order: list[int] = []
        # Empieza desde el punto de partida.
        current = (latitude, longitude)
        # Repite el bloque mientras pending.
        while pending:
            # min con key elige la parada pendiente más cercana al punto actual.
            next_index = min(
                pending,
                key=lambda index: haversine_km(
                    *current, float(places[index]["latitude"]), float(places[index]["longitude"])
                ),
            )
            order.append(next_index)
            pending.remove(next_index)
            # Desde la parada recién visitada se busca la siguiente.
            current = (
                float(places[next_index]["latitude"]),
                float(places[next_index]["longitude"]),
            )
        return order

    # Se calcula el óptimo siempre, como referencia para comparar el método elegido.
    optimal_route, optimal_distance = exact()
    # Rama condicional: se cumple algorithm == 'exact'.
    # Evaluaciones = cuántos órdenes se revisaron: n! (todas las permutaciones).
    if algorithm == "exact":
        route, total_distance = optimal_route, optimal_distance
        evaluations = math.factorial(len(places))
    # Rama condicional: se cumple algorithm == 'nearest_neighbor'.
    # Evaluaciones: en cada paso se miran las paradas pendientes (n + (n-1) + ... + 1), más 1
    # para medir la ruta final. Eso es n(n+1)/2 + 1.
    elif algorithm == "nearest_neighbor":
        route = nearest_neighbor()
        total_distance = distance(route)
        evaluations = len(places) * (len(places) + 1) // 2 + 1
    else:
        raise ValueError("Algoritmo de ruta no soportado.")

    # Se arma el detalle para la pantalla: cada tramo con su distancia desde la parada anterior.
    ordered_places = [places[index] for index in route]
    legs = []
    # "previous" empieza en el punto de partida y avanza por cada parada.
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
    # El último tramo es el regreso al punto de partida.
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
        # Historial: aquí solo hay un valor porque ninguno de los dos métodos mejora por pasos.
        "history_km": [round(total_distance, 3)],
    }


def optimize_hypothesis_budget(
    items: Sequence[dict[str, Any]], budget: int, algorithm: str
) -> dict[str, Any]:
    """Selecciona hipótesis bajo un tope de costo (problema de la mochila).

    Qué mide: el valor total esperado de una selección, siempre que su costo total no supere el
    presupuesto. Si una selección se pasa del presupuesto, se descarta (valor -1).

    ``expected_value`` solo ordena opciones propuestas por la persona. No predice resultados reales.

    Métodos disponibles:
    - ``exact``: prueba todas las combinaciones (2^n). Garantía: el óptimo.
      Costo: con 16 hipótesis son 65 536 combinaciones.
    - ``greedy_ratio``: ordena por valor / costo y toma lo que quepa.
      Garantía: ninguna; puede dejar fuera una combinación mejor.
      Costo: ordenar, O(n log n).
    """

    def score(indices: frozenset[int]) -> tuple[int, int]:
        """Valor y costo de una selección; si supera el presupuesto, el valor es -1."""
        cost = sum(int(items[index]["estimated_cost"]) for index in indices)
        value = sum(int(items[index]["expected_value"]) for index in indices)
        return (value if cost <= budget else -1), cost

    # Rama condicional: se cumple algorithm == 'exact'.
    if algorithm == "exact":
        evaluations = 0
        best_set: frozenset[int] = frozenset()
        best_value, best_cost = -1, 0
        # Recorre todas las combinaciones posibles. Cada número entre 0 y 2^n - 1 es una máscara
        # de bits: el bit i indica si la hipótesis i entra en la selección.
        for mask in range(1 << len(items)):
            selection = frozenset(i for i in range(len(items)) if mask & (1 << i))
            value, cost = score(selection)
            evaluations += 1
            # Rama condicional: se cumple value > best_value.
            if value > best_value:
                best_set, best_value, best_cost = selection, value, cost
    # Rama condicional: se cumple algorithm == 'greedy_ratio'.
    elif algorithm == "greedy_ratio":
        # Heurística voraz: ordena por valor esperado por cada peso de costo y toma lo que quepa.
        # Un costo de 0 se considera la mejor opción posible (valor infinito por costo).
        def ratio(index: int) -> float:
            """Valor esperado por cada unidad de costo de una hipótesis."""
            cost = int(items[index]["estimated_cost"])
            value = int(items[index]["expected_value"])
            return value / cost if cost else math.inf

        # "selected" crece con cada hipótesis que cabe; "spent" es lo que ya se gastó.
        selected: frozenset[int] = frozenset()
        spent = 0
        # Evaluaciones: aquí solo se ordena una vez, así que cuenta una evaluación por hipótesis.
        evaluations = len(items)
        # Itera index sobre sorted(range(len(items)), key=ratio, reverse=True).
        for index in sorted(range(len(items)), key=ratio, reverse=True):
            cost = int(items[index]["estimated_cost"])
            # Rama condicional: se cumple spent + cost <= budget.
            # Si no cabe, se salta y se intenta con la siguiente (más barata o menos valiosa).
            if spent + cost <= budget:
                selected = selected | {index}
                spent += cost
        best_set = selected
        best_value, best_cost = score(selected)
    else:
        raise ValueError("Algoritmo de presupuesto no soportado.")

    # Referencia óptima: el mejor valor posible, calculado por fuerza bruta.
    # Se calcula siempre para que la pantalla compare el método elegido contra el óptimo.
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
