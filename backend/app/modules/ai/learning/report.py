"""Entrena el árbol con hallazgos revisados y reporta qué tan confiable es. Área: aprendizaje.

Es el "director de orquesta" del módulo de aprendizaje. Une los pasos en orden:
1. Revisa si hay datos suficientes (compuerta).
2. Separa los ejemplos en entrenamiento, validación y prueba.
3. Entrena el árbol solo con entrenamiento.
4. Mide el árbol en validación y en prueba.
5. Devuelve el resultado listo para mostrar a una persona.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from app.modules.ai.learning.decision_tree import DecisionTreeClassifier
from app.modules.ai.learning.evaluation import binary_metrics, readiness, split_indices
from app.modules.ai.learning.features import FEATURE_NAMES

# Etiquetas de las dos clases. Coinciden con los estados de revisión que guarda la base de datos.
POSITIVE = "accepted"
NEGATIVE = "rejected"
# Mínimo de ejemplos por clase. Es una regla práctica del proyecto, no una garantía estadística:
# con menos ejemplos, la validación y la prueba tienen muy pocos casos y pueden engañar.
MIN_PER_CLASS = 20
# Límites del árbol: 3 preguntas seguidas como máximo y al menos 3 ejemplos por hoja. Son valores
# conservadores para evitar que el árbol memorice un conjunto de datos pequeño.
MAX_DEPTH = 3
MIN_SAMPLES_LEAF = 3
# Semilla del reparto de datos. Fijarla hace que el mismo conjunto de datos dé siempre el mismo
# entrenamiento y las mismas métricas, lo que permite comparar versiones del motor.
SEED = 42


def build_finding_report(
    rows: Sequence[Sequence[float]],
    labels: Sequence[str],
    *,
    min_per_class: int = MIN_PER_CLASS,
) -> dict[str, Any]:
    """Entrena el árbol de hallazgos y lo evalúa; si no hay datos suficientes, no entrena.

    Entradas: rows (la fila de números de cada hallazgo) y labels (su clase: aceptado o rechazado).
    Salida: un diccionario con:
    - readiness: si había datos suficientes y los conteos.
    - model: None si no se entrenó; si se entrenó, el tamaño del entrenamiento, las métricas en
      validación y en prueba, y las reglas del árbol en texto.

    El árbol aprende solo del 60 % de los ejemplos. Las métricas se miden en validación (20 %) y en
    prueba (20 %). Los datos de prueba no se usan para entrenar, para que el resultado sea honesto.
    """
    status = readiness(labels, POSITIVE, NEGATIVE, min_per_class)
    # Compuerta: sin ejemplos suficientes de las dos clases, no se entrena ni se inventan métricas.
    if not status["trainable"]:
        return {"readiness": status, "model": None}

    train, validation, test = split_indices(len(rows), SEED)
    tree = DecisionTreeClassifier(max_depth=MAX_DEPTH, min_samples_leaf=MIN_SAMPLES_LEAF)
    # Solo los ejemplos de entrenamiento entran al árbol.
    tree.fit([rows[i] for i in train], [labels[i] for i in train], FEATURE_NAMES)

    def score(indices: list[int]) -> dict[str, Any]:
        """Mide el árbol sobre un grupo de ejemplos (validación o prueba)."""
        predictions = tree.predict([rows[i] for i in indices])
        return binary_metrics([labels[i] for i in indices], predictions, POSITIVE)

    return {
        "readiness": status,
        "model": {
            "max_depth": MAX_DEPTH,
            "train_size": len(train),
            "validation_metrics": score(validation),
            "test_metrics": score(test),
            "rules": tree.describe(),
        },
    }
