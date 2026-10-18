# IdeaForgeIA

Plataforma web en español para estructurar, investigar, analizar, evaluar y validar ideas de negocio con Inteligencia Artificial explicable (Google Gemini + Ollama local), búsqueda web con citas trazables y exploración geográfica con OpenStreetMap + Leaflet.

## Estructura del repositorio

- `backend/` — API REST asíncrona con **Python 3.13 + FastAPI + SQLAlchemy 2.0 + PostgreSQL 18 + Alembic**.
- `frontend/` — Aplicación SPA / PWA con **React 19 + TypeScript 7 + Vite 8 + Tailwind CSS v4 + Leaflet**.
- `prender proyecto.md` — Guía paso a paso para configurar variables de entorno (`.env`) y levantar el proyecto en local o despliegue.
- `ESTRUCTURA_CODIGO_IDEAFORGE_AI.html` — Documentación de la arquitectura de carpetas y propósito de cada archivo.

## Configuración rápida (sin exponer claves en Git)

1. Copia las plantillas de variables de entorno:
   ```powershell
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```
2. Edita `backend/.env` con tu conexión de PostgreSQL (`DATABASE_URL`), una `SECRET_KEY` de al menos 32 caracteres y tu proveedor de IA (`AI_PROVIDER=ollama` o `AI_PROVIDER=gemini` con tu `GEMINI_API_KEY`).
3. Sigue los comandos de **`prender proyecto.md`** para levantar backend (`:8000`) y frontend (`:5173`).
