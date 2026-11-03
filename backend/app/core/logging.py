"""Configura el registro de mensajes (logs) del backend.

ARCHIVO: backend/app/core/logging.py

¿Qué es?
Un único lugar que decide cómo se ven los mensajes que el backend escribe en la consola:
hora, nivel (INFO, WARNING, ERROR...), nombre del módulo y el texto.

¿Para qué sirve?
Para revisar qué pasa mientras el servidor corre. Por ejemplo, las advertencias de
investigaciones interrumpidas aparecen aquí.

¿Quién lo usa?
main.py, al crear la aplicación, con el valor LOG_LEVEL del archivo de configuración.

Cambios comunes:
- Más o menos detalle: cambia LOG_LEVEL en backend/.env (DEBUG muestra más, ERROR muestra menos).
- Otro formato: cambia el texto de "format" (el orden de la hora, el nivel y el módulo).
"""

import logging


def configure_logging(level: str) -> None:
    """Fija el nivel mínimo de los mensajes y el formato con el que se imprimen.

    Recibe: level, el nivel mínimo (por ejemplo "INFO"). Solo se muestran los mensajes de ese
    nivel o más graves.
    """
    logging.basicConfig(
        level=level,
        # Formato: "2026-10-31 10:00:00,123 INFO [app.main] mensaje".
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        # force=True reemplaza cualquier configuración previa, así no se duplican los mensajes.
        force=True,
    )
