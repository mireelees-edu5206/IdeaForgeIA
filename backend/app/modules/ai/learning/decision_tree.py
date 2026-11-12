"""Árbol de decisión CART en Python puro. Área: aprendizaje del motor de IA.

Qué es un árbol de decisión:
Es una serie de preguntas de tipo "¿el valor de esta variable es menor o igual a X?". Cada pregunta
separa los ejemplos en dos grupos (ramas). Al final de cada rama hay una hoja con una clase, por
ejemplo "accepted" o "rejected". Para clasificar un caso nuevo, se responde las preguntas desde
arriba hasta llegar a una hoja.

Cómo lo aprende (algoritmo CART):
1. Mira todos los ejemplos del nodo actual.
2. Prueba cada rasgo y cada corte posible, y calcula cuánto mejora la separación (la "ganancia").
3. Se queda con la pregunta que más ordena las clases y crea dos ramas.
4. Repite el proceso en cada rama hasta que se cumpla un límite (profundidad máxima, pocos
   ejemplos, o todos los ejemplos de la rama tienen la misma clase).

Qué mide la separación: la impureza de Gini. Vale 0 si todos los ejemplos de un grupo tienen la
misma clase, y se acerca a 1 cuando las clases se mezclan. El árbol elige el corte que más reduce la
impureza, ponderada por el tamaño de cada rama.

Evaluación del algoritmo:
- Ventaja: es legible. Cada decisión se puede escribir como regla (ver ``describe``).
- Límite: puede memorizar ejemplos si crece demasiado. Por eso se limita la profundidad y el número
  mínimo de ejemplos por hoja.
- Límite: con pocos datos, cualquier regla parece buena por casualidad. El módulo de informe exige
  un mínimo de ejemplos antes de confiar en el árbol.
- Costo de entrenamiento: para cada nodo, prueba cada rasgo y cada corte. Es aceptable para cientos
  de ejemplos, pero crece rápido con miles.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field


@dataclass
class TreeNode:
    """Nodo del árbol: una hoja (sin pregunta) o un nodo con la pregunta feature <= threshold.

    - label: la clase mayoritaria de los ejemplos que llegan a este nodo. Es la respuesta si el
      nodo es una hoja, y también sirve de respaldo si el nodo tiene preguntas.
    - counts: cuántos ejemplos de cada clase llegaron a este nodo. Sirve para revisar el árbol.
    - feature y threshold: la pregunta. feature es el índice del rasgo; threshold, el corte.
    - left y right: las dos ramas. Si ``feature`` es None, el nodo es una hoja y no tiene ramas.
    """

    label: str
    counts: dict[str, int] = field(default_factory=dict)
    feature: int | None = None
    threshold: float | None = None
    left: TreeNode | None = None
    right: TreeNode | None = None


def gini(labels: Sequence[str]) -> float:
    """Impureza de Gini: 0 si todas las etiquetas son iguales; más alta si están mezcladas.

    Fórmula: 1 - suma de (proporción de cada clase)². Ejemplos:
    - ["a", "a", "a"] → 1 - 1² = 0 (nada mezclado).
    - ["a", "b"] → 1 - (0.5² + 0.5²) = 0.5 (mitad y mitad, lo más mezclado en dos clases).
    Un grupo vacío se considera puro (0) para no dividir entre cero.
    """
    total = len(labels)
    if total == 0:
        return 0.0
    # Counter cuenta cuántas veces aparece cada clase; luego se calcula la proporción de cada una.
    return 1.0 - sum((count / total) ** 2 for count in Counter(labels).values())


class DecisionTreeClassifier:
    """Clasificador de árbol de decisión que aprende de ejemplos etiquetados.

    Uso típico:
        tree = DecisionTreeClassifier(max_depth=3, min_samples_leaf=3)
        tree.fit(filas, etiquetas, nombres_de_rasgos)
        tree.predict(filas_nuevas)
        tree.describe()  # reglas en texto
    """

    def __init__(self, max_depth: int = 3, min_samples_leaf: int = 2) -> None:
        """Define los límites que evitan que el árbol memorice.

        - max_depth: cuántas preguntas seguidas puede hacer el árbol como máximo. Con 3, una
          respuesta depende de hasta 3 preguntas. Más profundidad = más detalle, pero más riesgo de
          memorizar los ejemplos de entrenamiento.
        - min_samples_leaf: cuántos ejemplos debe tener cada rama como mínimo. Evita reglas hechas
          para uno o dos casos aislados.
        """
        if max_depth < 1 or min_samples_leaf < 1:
            raise ValueError("max_depth y min_samples_leaf deben ser mayores o iguales a 1.")
        self.max_depth = max_depth
        self.min_samples_leaf = min_samples_leaf
        # Los nombres de los rasgos se guardan para poder escribir las reglas en lenguaje legible.
        self.feature_names: list[str] = []
        # root es el primer nodo. Mientras no se entrene el árbol, vale None.
        self.root: TreeNode | None = None

    def fit(
        self,
        rows: Sequence[Sequence[float]],
        labels: Sequence[str],
        feature_names: Sequence[str],
    ) -> DecisionTreeClassifier:
        """Aprende el árbol a partir de las filas (una por ejemplo) y sus etiquetas.

        Entrada: rows, una lista de listas de números (un rasgo por columna); labels, la clase de
        cada fila; feature_names, el nombre de cada columna.
        Salida: el propio árbol, ya entrenado, para poder encadenar llamadas.
        Error: si no hay filas o si filas y etiquetas no tienen el mismo tamaño.
        """
        if not rows or len(rows) != len(labels):
            raise ValueError("Se necesitan filas y etiquetas del mismo tamaño.")
        self.feature_names = list(feature_names)
        # Se copian las filas para no modificar las listas que pasó quien llama.
        self.root = self._grow([list(row) for row in rows], list(labels), depth=0)
        return self

    def predict_one(self, row: Sequence[float]) -> str:
        """Recorre las preguntas desde la raíz y devuelve la clase de la hoja que llega.

        Cada vez que el nodo tiene pregunta, se compara el valor del rasgo con el corte: si es menor
        o igual, se sigue por la rama izquierda; si no, por la derecha. Tarda lo que mide la
        profundidad del árbol, como mucho ``max_depth`` pasos.
        """
        if self.root is None:
            raise RuntimeError("El árbol todavía no está entrenado.")
        node = self.root
        # El ciclo baja nodo por nodo mientras el nodo tenga pregunta (es decir, no sea hoja).
        while node.feature is not None and node.left is not None and node.right is not None:
            node = node.left if row[node.feature] <= node.threshold else node.right
        return node.label

    def predict(self, rows: Sequence[Sequence[float]]) -> list[str]:
        """Clasifica varias filas, una por una. Devuelve la lista de clases en el mismo orden."""
        return [self.predict_one(row) for row in rows]

    def describe(self) -> list[str]:
        """Escribe el árbol como líneas de texto, para que una persona pueda leer sus reglas.

        Ejemplo de salida:
            si supports_count <= 1.50:
              → rejected
            si no:
              → accepted
        La sangría (los espacios) muestra qué preguntas dependen de otras.
        """
        if self.root is None:
            return []
        lines: list[str] = []

        def walk(node: TreeNode, depth: int) -> None:
            """Escribe un nodo y, si tiene pregunta, sus dos ramas con sangría."""
            # Cada nivel de profundidad agrega dos espacios de sangría.
            pad = "  " * depth
            if node.feature is None or node.left is None or node.right is None:
                lines.append(f"{pad}→ {node.label}")
                return
            question = f"si {self.feature_names[node.feature]} <= {node.threshold:.2f}:"
            lines.append(f"{pad}{question}")
            walk(node.left, depth + 1)
            lines.append(f"{pad}si no:")
            walk(node.right, depth + 1)

        walk(self.root, 0)
        return lines

    def _grow(self, rows: list[list[float]], labels: list[str], depth: int) -> TreeNode:
        """Crea un nodo; si no conviene dividirlo más, es una hoja con la clase mayoritaria.

        Tres razones para parar y crear una hoja:
        1. Se llegó a la profundidad máxima.
        2. Todos los ejemplos tienen la misma clase (ya no hay nada que separar).
        3. Hay muy pocos ejemplos para dar dos ramas con el mínimo por hoja.
        Si ninguna aplica, se busca la mejor pregunta y se crean dos nodos hijos recursivamente.
        """
        # La clase mayoritaria es la respuesta por defecto del nodo.
        node = TreeNode(label=Counter(labels).most_common(1)[0][0], counts=dict(Counter(labels)))
        if depth >= self.max_depth or len(set(labels)) == 1:
            return node
        if len(labels) < 2 * self.min_samples_leaf:
            return node
        split = self._best_split(rows, labels)
        if split is None:
            return node
        feature, threshold, left_idx, right_idx = split
        node.feature, node.threshold = feature, threshold
        # Recursión: cada rama se construye con el mismo procedimiento, un nivel más profundo.
        node.left = self._grow(
            [rows[i] for i in left_idx], [labels[i] for i in left_idx], depth + 1
        )
        node.right = self._grow(
            [rows[i] for i in right_idx], [labels[i] for i in right_idx], depth + 1
        )
        return node

    def _best_split(
        self, rows: list[list[float]], labels: list[str]
    ) -> tuple[int, float, list[int], list[int]] | None:
        """Busca la pregunta que más reduce la impureza. Devuelve None si ninguna mejora.

        Para cada rasgo: ordena sus valores distintos y prueba un corte entre cada par de valores
        consecutivos (en el punto medio). Para cada corte calcula la ganancia:
            ganancia = impureza_total - (peso_izq × Gini_izq) - (peso_der × Gini_der)
        Se queda con el corte de mayor ganancia. Si no hay ganancia positiva, no conviene dividir.
        El umbral 1e-12 evita quedarse por errores de redondeo de punto flotante.
        Costo: O(rasgos × valores_distintos × ejemplos) por nodo.
        """
        base = gini(labels)
        total = len(labels)
        best_gain = 0.0
        best: tuple[int, float, list[int], list[int]] | None = None
        for feature in range(len(self.feature_names)):
            values = sorted({row[feature] for row in rows})
            # Cada posible corte queda justo a la mitad entre dos valores consecutivos.
            for low, high in zip(values, values[1:], strict=False):
                threshold = (low + high) / 2
                left = [i for i, row in enumerate(rows) if row[feature] <= threshold]
                right = [i for i, row in enumerate(rows) if row[feature] > threshold]
                # Se descartan cortes que dejen una rama con menos ejemplos que el mínimo.
                if len(left) < self.min_samples_leaf or len(right) < self.min_samples_leaf:
                    continue
                # Ganancia: cuánto baja la impureza al separar en estas dos ramas.
                gain = (
                    base
                    - (len(left) / total) * gini([labels[i] for i in left])
                    - (len(right) / total) * gini([labels[i] for i in right])
                )
                if gain > best_gain + 1e-12:
                    best_gain, best = gain, (feature, threshold, left, right)
        return best
