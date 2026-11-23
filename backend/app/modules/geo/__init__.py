"""Geocodificación y puntos de interés mediante proveedores intercambiables. Area: geografia.

ARCHIVO: backend/app/modules/geo/__init__.py

¿Qué es?
El paquete de geografía: errores (`errors.py`), esquemas (`schemas.py`), servicio (`service.py`),
router (`router.py`) y los proveedores (`providers/`).

¿Para qué sirve?
Para que la lógica de mapas quede separada del resto de la aplicación y pueda cambiar de proveedor
sin reescribir los endpoints.
"""
