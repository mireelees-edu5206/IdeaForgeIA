"""Utilidad de soporte. Area: aplicacion."""

import logging


def configure_logging(level: str) -> None:
    """Gestiona configure logging."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        force=True,
    )
