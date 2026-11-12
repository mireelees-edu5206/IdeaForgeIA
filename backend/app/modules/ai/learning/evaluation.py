"""Separación de datos, métricas y compuerta de datos suficientes. Área: aprendizaje de IA.

Este archivo responde tres preguntas antes de confiar en un modelo:
1. ¿Cómo separo los datos para no hacer trampa? (split_indices)
2. ¿Qué tan bien acierta el modelo? (binary_metrics)
3. ¿Tengo suficientes ejemplos para que la medición signifique algo? (readiness)
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from typing import Any


def split_indices(
    total: int, seed: int, test_ratio: float = 0.2, validation_ratio: float = 0.2
) -> tuple[list[int], list[int], list[int]]:
    """Reparte los índices en entrenamiento, validación y prueba.

    Por qué tres grupos:
    - Entrenamiento (lo que queda, ~60 %): el modelo aprende solo de aquí.
    - Validación (20 %): sirve para revisar el modelo mientras se desarrolla.
    - Prueba (20 %): se mide al final, sin haberla usado para nada más. Así el resultado no está
      "contaminado" por haber visto esos casos antes.

    Cómo: se mezclan los índices con una semilla fija (random.Random(seed)). Con la misma semilla
    siempre sale el mismo reparto, así que los resultados se pueden repetir y comparar.
    Garantía: los tres grupos no se cruzan y juntos cubren todos los ejemplos.
    Costo: barajar la lista, O(n).
    """
    indices = list(range(total))
    random.Random(seed).shuffle(indices)
    # max(1, ...) asegura al menos un ejemplo en validación y en prueba, aunque el total sea chico.
    test_size = max(1, round(total * test_ratio))
    validation_size = max(1, round(total * validation_ratio))
    # Los cortes se hacen sobre la lista ya mezclada: primero prueba, luego validación, y el resto.
    test = indices[:test_size]
    validation = indices[test_size : test_size + validation_size]
    train = indices[test_size + validation_size :]
    return train, validation, test


def binary_metrics(y_true: Sequence[str], y_pred: Sequence[str], positive: str) -> dict[str, Any]:
    """Mide qué tan bien acierta el modelo para la clase positiva.

    Primero se cuentan cuatro casos (la matriz de confusión):
    - true_positive: era positivo y el modelo dijo positivo (acierto).
    - false_positive: no era positivo y el modelo dijo positivo (falsa alarma).
    - false_negative: era positivo y el modelo dijo no positivo (se le escapó).
    - true_negative: no era positivo y el modelo dijo no positivo (acierto).

    Luego se calculan las métricas:
    - accuracy = (aciertos totales) / total. Engaña si las clases están desbalanceadas: un modelo
      que siempre dice "rechazado" puede tener buena precisión global sin servir de nada.
    - precision = tp / (tp + fp). De lo que el modelo marca como positivo, cuánto sí lo era.
    - recall = tp / (tp + fn). De los positivos reales, cuántos encontró el modelo.
    - f1 = 2 × precision × recall / (precision + recall). Un solo número que equilibra las dos.
    Si una división tiene cero en el denominador (por ejemplo, el modelo nunca dijo positivo), esa
    métrica vale 0 en vez de romper el programa.
    Costo: cuatro recorridos de la lista, O(n).
    """
    # zip(..., strict=True) exige que las dos listas tengan el mismo tamaño, o da error.
    pairs = list(zip(y_true, y_pred, strict=True))
    tp = sum(1 for t, p in pairs if t == positive and p == positive)
    fp = sum(1 for t, p in pairs if t != positive and p == positive)
    fn = sum(1 for t, p in pairs if t == positive and p != positive)
    tn = sum(1 for t, p in pairs if t != positive and p != positive)
    total = len(pairs)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "accuracy": round((tp + tn) / total, 3) if total else 0.0,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "true_positive": tp,
        "false_positive": fp,
        "false_negative": fn,
        "true_negative": tn,
    }


def readiness(
    labels: Sequence[str], positive: str, negative: str, min_per_class: int
) -> dict[str, Any]:
    """Dice si hay ejemplos suficientes de las dos clases para entrenar y evaluar sin engañarse.

    Por qué existe: con muy pocos ejemplos, una métrica puede verse perfecta solo por casualidad.
    Por ejemplo, con 2 casos en prueba, acertar ambos da 100 % de precisión sin demostrar nada.
    Por eso se exige el mínimo de ejemplos en cada clase, no solo en total: si solo hay aceptados,
    el modelo aprendería a decir "aceptado" siempre y parecería bueno.

    Entrada: labels (la clase de cada ejemplo), positive y negative (los nombres de las clases) y
    min_per_class (el mínimo exigido de cada una).
    Salida: un diccionario con los conteos, si se puede entrenar y un mensaje para la persona.
    """
    positives = sum(1 for label in labels if label == positive)
    negatives = sum(1 for label in labels if label == negative)
    trainable = positives >= min_per_class and negatives >= min_per_class
    if trainable:
        message = (
            f"Hay {positives} ejemplos aceptados y {negatives} rechazados: suficiente para "
            "entrenar y evaluar el árbol."
        )
    else:
        message = (
            f"Se necesitan al menos {min_per_class} ejemplos de cada clase. Hay {positives} "
            f"aceptados y {negatives} rechazados; el árbol no se entrena todavía."
        )
    return {
        "positive_examples": positives,
        "negative_examples": negatives,
        "min_per_class": min_per_class,
        "trainable": trainable,
        "message": message,
    }
