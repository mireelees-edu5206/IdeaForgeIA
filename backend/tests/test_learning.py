"""Pruebas del aprendizaje del motor: árbol de decisión, métricas, compuerta e informe."""

import random

import pytest

from app.modules.ai.learning.decision_tree import DecisionTreeClassifier, gini
from app.modules.ai.learning.evaluation import binary_metrics, readiness, split_indices
from app.modules.ai.learning.features import FEATURE_NAMES, finding_feature_row
from app.modules.ai.learning.report import build_finding_report


def test_gini_is_zero_for_identical_labels_and_half_for_an_even_split() -> None:
    """La impureza vale 0 cuando todas son iguales y 0.5 cuando hay dos clases mitad y mitad."""
    assert gini(["accepted", "accepted"]) == 0.0
    assert gini(["accepted", "rejected"]) == pytest.approx(0.5)
    assert gini([]) == 0.0


def test_tree_learns_a_threshold_and_predicts_both_sides() -> None:
    """Con una sola frontera clara, el árbol aprende el corte y clasifica casos nuevos."""
    tree = DecisionTreeClassifier(max_depth=1, min_samples_leaf=1)
    tree.fit([[1], [2], [8], [9]], ["rejected", "rejected", "accepted", "accepted"], ["score"])

    assert tree.predict([[1.5], [8.5]]) == ["rejected", "accepted"]


def test_tree_describe_writes_the_question_and_both_leaves() -> None:
    """La descripción muestra la pregunta aprendida y la clase de cada rama."""
    tree = DecisionTreeClassifier(max_depth=1, min_samples_leaf=1)
    tree.fit([[1], [2], [8], [9]], ["rejected", "rejected", "accepted", "accepted"], ["score"])

    assert tree.describe() == [
        "si score <= 5.00:",
        "  → rejected",
        "si no:",
        "  → accepted",
    ]


def test_tree_rejects_invalid_settings_and_mismatched_data() -> None:
    """Un árbol sin profundidad o con datos desalineados no se entrena."""
    with pytest.raises(ValueError, match="mayores o iguales a 1"):
        DecisionTreeClassifier(max_depth=0)
    with pytest.raises(ValueError, match="mismo tamaño"):
        DecisionTreeClassifier().fit([[1.0], [2.0]], ["accepted"], ["score"])
    with pytest.raises(RuntimeError, match="no está entrenado"):
        DecisionTreeClassifier().predict_one([1.0])


def test_split_is_repeatable_disjoint_and_covers_every_example() -> None:
    """Con la misma semilla el reparto es igual, los grupos no se cruzan y suman todos los casos."""
    first = split_indices(50, seed=7)
    assert first == split_indices(50, seed=7)
    train, validation, test = first
    assert set(train).isdisjoint(validation) and set(validation).isdisjoint(test)
    assert sorted(train + validation + test) == list(range(50))
    assert len(test) == 10 and len(validation) == 10


def test_binary_metrics_counts_the_confusion_matrix() -> None:
    """Cada celda de la matriz cuenta bien y las métricas salen de esos conteos."""
    metrics = binary_metrics(
        ["accepted", "accepted", "rejected", "rejected"],
        ["accepted", "rejected", "accepted", "rejected"],
        positive="accepted",
    )

    assert (metrics["true_positive"], metrics["false_negative"]) == (1, 1)
    assert (metrics["false_positive"], metrics["true_negative"]) == (1, 1)
    assert metrics["accuracy"] == metrics["precision"] == metrics["recall"] == 0.5
    assert metrics["f1"] == 0.5


def test_binary_metrics_is_zero_when_a_division_has_no_cases() -> None:
    """Si el modelo nunca predice la clase positiva, precisión y F1 valen 0 sin dividir por cero."""
    metrics = binary_metrics(["accepted", "rejected"], ["rejected", "rejected"], "accepted")

    assert metrics["precision"] == 0.0
    assert metrics["recall"] == 0.0
    assert metrics["f1"] == 0.0


def test_readiness_needs_at_least_the_minimum_of_both_classes() -> None:
    """La compuerta bloquea el entrenamiento hasta tener ejemplos de las dos clases."""
    only_accepted = readiness(["accepted"] * 25, "accepted", "rejected", min_per_class=20)
    assert only_accepted["trainable"] is False
    assert only_accepted["negative_examples"] == 0

    both = readiness(["accepted"] * 20 + ["rejected"] * 20, "accepted", "rejected", 20)
    assert both["trainable"] is True


def test_feature_row_follows_the_declared_feature_order() -> None:
    """La fila de números sigue el orden de FEATURE_NAMES y cuenta posturas, dominios y cifras."""
    row = finding_feature_row(
        finding_type="pricing",
        statement="El plan cuesta 12000 pesos al mes",
        confidence_score=0.8,
        stances=["supports", "supports", "contradicts"],
        domains=["a.example", "a.example", "b.example"],
    )

    values = dict(zip(FEATURE_NAMES, row, strict=True))
    assert values["confidence_score"] == 0.8
    assert values["evidence_count"] == 3
    assert values["supports_count"] == 2
    assert values["contradicts_count"] == 1
    assert values["distinct_domains"] == 2
    assert values["mentions_amount"] == 1.0
    assert values["is_pricing"] == 1.0


def test_report_does_not_train_without_enough_reviewed_examples() -> None:
    """Sin ejemplos suficientes, el informe explica por qué no hay árbol y no inventa métricas."""
    report = build_finding_report([[0.0] * len(FEATURE_NAMES)], ["accepted"])

    assert report["model"] is None
    assert report["readiness"]["trainable"] is False


def test_report_learns_a_clear_rule_and_scores_it_on_held_out_data() -> None:
    """Con una regla clara (2 o más apoyos), el árbol la aprende y la prueba la confirma."""
    random_generator = random.Random(3)
    rows, labels = [], []
    for _ in range(120):
        supports = float(random_generator.randint(0, 4))
        row = [0.5, supports + 1, supports, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0]
        rows.append(row)
        labels.append("accepted" if supports >= 2 else "rejected")

    report = build_finding_report(rows, labels)

    assert report["readiness"]["trainable"] is True
    model = report["model"]
    assert model is not None
    assert model["train_size"] == 72
    assert model["test_metrics"]["accuracy"] >= 0.95
    assert model["rules"][0].startswith("si ")
    assert any(line.strip().startswith("→") for line in model["rules"])
