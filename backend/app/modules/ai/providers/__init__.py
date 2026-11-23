"""Agrupa los proveedores de IA del motor. Area: proveedores de IA.

ARCHIVO: backend/app/modules/ai/providers/__init__.py

¿Qué es?
El paquete con la interfaz común (`base.py`), el motor propio (`engine.py`), la búsqueda pública
(`web_search.py`), el proveedor de pruebas (`fake.py`) y el cliente HTTP (`http.py`).

¿Para qué sirve?
Para que el resto del backend use `AIOrchestrator` y nunca importe un proveedor directamente.
"""
