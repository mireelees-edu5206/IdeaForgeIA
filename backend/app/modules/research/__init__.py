"""Marca el paquete y su limite de imports. Area: investigacion web.

ARCHIVO: backend/app/modules/research/__init__.py

¿Qué es?
Un archivo vacío a propósito. Su única función es decirle a Python que esta carpeta es un paquete
(un módulo que se puede importar desde otros archivos).

¿Para qué sirve?
Para que otros archivos puedan escribir "from app.modules.research import ...".
No contiene código. Si se agrega algo aquí, cargará el módulo completo cada vez que se use, así
que se evita poner código en este archivo.
"""
