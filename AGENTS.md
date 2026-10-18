# IdeaForge AI - notas del proyecto

Desarrollo incremental por fases: implementar solo la fase indicada por el usuario y esperar confirmación.

## Resumen de fases del proyecto

### FASE 1 ✅
Análisis del proyecto y arquitectura.

### FASE 2 ✅
Diseño definitivo de PostgreSQL.

### FASE 3 ✅
Configuración del backend con Python + FastAPI.

### FASE 4 ✅
Modelos, migraciones y conexión con PostgreSQL.

### FASE 5 ✅
Autenticación y usuarios.

### FASE 6 ✅
Gestión de proyectos e ideas.

### FASE 7 ✅
Frontend base con React + TypeScript + TailwindCSS.

### FASE 8 ✅
Dashboard y flujo principal de IdeaForge AI (confirmar estructura).

### FASE 9 ✅
Módulo de investigación y fuentes (orquestador, búsqueda con grounding).

### FASE 10 ✅
Hallazgos, entidades, competidores y evidencia (extracción y revisión).

### FASE 11 ✅
Oportunidades, riesgos, hipótesis e información faltante.
- ✅ Backend completo (modelos, servicio, router, runner)
- ✅ Frontend completo (`features/analysis/AnalysisTab.tsx` con los 4 cuadrantes, CRUD, aceptación/rechazo y trazabilidad hacia hallazgos y fuentes)

### FASE 12 ✅
Integración de Gemini + Ollama + AI Orchestrator (Grok eliminado del proyecto, IA real en lugar de fake; fallback web público DuckDuckGo/Wikipedia cuando Google Search devuelve `429`).

### FASE 13 ✅
Chatbot contextual (`POST /projects/{id}/chat`, `features/chat/ChatTab.tsx` con historial acotado y referencias verificables).

### FASE 14 ✅
Generación de informes versionados por proyecto: borrador en segundo plano, síntesis estructurada,
fuentes y evidencias rastreables, descarga Markdown e impresión a PDF.

### FASE 15 ✅
PWA, mapas, geolocalización, optimización y experiencia móvil.
- OpenStreetMap + Nominatim (geocodificación) + Overpass API (lugares/negocios) + Leaflet/react-leaflet (mapas en frontend).
- Geo Provider desacoplado para permitir cambio de proveedor futuro.
- API geográfica autenticada con búsquedas manuales; Nominatim limitado a 1 req/s y caché, Overpass con radio/resultados acotados y caché. GeoProvider es intercambiable.
- Mapa Leaflet en Competidores con búsqueda manual, ubicación del dispositivo bajo permiso explícito, categorías/radio, atribución y aviso de que los lugares mapeados no prueban competencia.
- PWA instalable con manifiesto, pantalla offline y caché del shell/archivos estáticos. Nunca cachea `/api`, coordenadas, búsquedas o datos privados.

### FASE 16 ⏸️ (en pausa por indicación del usuario)
Seguridad, pruebas y corrección de errores.

### FASE 17 ⏸️ (en pausa por indicación del usuario)
Preparación para producción.

## Backend (`backend/`)
- Python 3.13 gestionado con `uv`. El entorno virtual vive FUERA de OneDrive:
  `UV_PROJECT_ENVIRONMENT=C:\Users\bhera\.venvs\ideaforge-backend` (definirlo en cada sesión).
- `pyproject.toml` usa `exclude-newer` (solo paquetes con >= 7 días publicados).
- Comandos (desde `backend/`):
  - Dependencias: `uv sync` / `uv add <pkg>` / `uv add --dev <pkg>`
  - Servidor: `uv run uvicorn app.main:app --reload --reload-dir app --port 8000` (`--reload-dir app` evita reinicios cuando se ejecutan tests o cambia `.venv`)
  - Tests: `uv run pytest -q`
  - Lint/format: `uv run ruff check .` y `uv run ruff format --check .`
- Errores de API siempre con formato `{"error": {"code", "message", "details?"}}` (`app/core/errors.py`).

## Frontend (`frontend/`)
- React 19 + TypeScript 7 (estricto) + Vite 8 + Tailwind v4 (`@tailwindcss/vite`, tokens en `src/styles/index.css`) + React Router 7 + TanStack Query 5 + react-icons. Versiones exactas en `package.json`.
- Instalar dependencias nuevas con `npm install --before=<fecha de hace 7 días> --save-exact <pkg>`.
- Comandos (desde `frontend/`): `npm run dev` (http://localhost:5173, proxy `/api` → backend :8000), `npm run typecheck`, `npm test` (Vitest + Testing Library), `npm run build`.
- Estructura: `src/app` (router, providers), `src/components/ui` (sistema de diseño), `src/components/layout`, `src/features/<modulo>`, `src/lib` (apiClient, tokenStorage, queryClient).
- Dirección visual («Observatorio Cósmico»): paleta morada/amatista con modo claro marfil (`#faf8ff`) y modo oscuro abismo (`#06030f`, `document.documentElement.dataset.theme = "dark"`, `localStorage("ideaforge-theme")`). Único `<Canvas>` Three.js (`three@0.186.0`) lazy-loaded en `Backdrop.tsx` (`ForgeCanvas.tsx`) con 2 galaxias espirales, nubes nebulares, 2 cinturones de asteroides, 2 cometas y 3 400 estrellas. La escena actual excluye agujero negro, soles, planetas, lunas/satélites y personajes; en móvil el campo de fondo se centra automáticamente (`targetX = 0`, `fov = 54`, `z = 9.4`).
- Glassmorphism calibrado: `glass` usa `backdrop-filter: blur(12px) saturate(145%)` y `stage-3d` usa `blur(15px) saturate(150%)`. Importante: NO poner `opacity < 1` en `ForgeCanvas`, ni `-z-10` en `Backdrop`, ni `transform-style: preserve-3d` en contenedores padre, porque rompen `backdrop-filter` en Chromium/Edge.
- Utilidades visuales propias: `glass`, `stage-3d`, `neo-raised`, `neo-inset`, `tilt-3d`, `fog-uncertain`, `filament-line`, `jelly`, `text-gradient`, `animate-fade-up`. Respetan `prefers-reduced-motion`.
- Todas las llamadas HTTP pasan por `apiRequest` (`src/lib/apiClient.ts`): añade el Bearer, convierte errores en `ApiError` y renueva la sesión UNA vez (promesa compartida + Web Lock entre pestañas).
- Nunca usar `dangerouslySetInnerHTML` con contenido de la API/IA (tokens en localStorage).
- Textos de la interfaz directamente en español. Etiquetas de enums del backend en `src/features/projects/constants.ts`.
- Datos del servidor con TanStack Query: claves en `projectKeys` (`src/features/projects/queries.ts`); cada mutación invalida `["projects"]`.
- Tests: `renderRoutes` + `apiRoutes` (`src/test/render.tsx`) para simular la API por método y ruta.
- Rutas: `/`, `/proyectos` (`?estado=&pagina=`), `/proyectos/nuevo`, `/configuracion` (cuenta, correo, selector de tema claro/oscuro, instalación PWA y cerrar sesión), `/admin` (exclusivo `role === "admin"`, protegido con `RequireAdmin`), `/proyectos/:projectId` (+ `/investigacion`, `/hallazgos`, `/competidores`, `/analisis`, `/asistente`, `/fuentes`, `/reportes`), `/iniciar-sesion`, `/registro`.
- Si Vitest falla con "Timeout waiting for worker to respond", es el arranque lento en OneDrive: reintentar.

## Flujo de proyecto (Fase 8)
- `draft` → `structured` solo con `POST /projects/{id}/confirm-structure`: exige problema, solución y segmento con al menos un valor confirmado y ninguna sugerencia de IA pendiente (`check_structure` en `projects/service.py`).
- Editar `raw_idea` o cualquier atributo lo devuelve a `draft` desde cualquier estado (el título no). Con una investigación activa, editar la idea/atributos o borrar el proyecto da 409 `research_in_progress`.

## IA e investigación (Fase 9)
- Capa de IA en `app/modules/ai/`: interfaz `AIProvider`, adaptadores Gemini/Ollama, `AIOrchestrator`, tipos y errores neutrales; `timed_call` + `build_call_logs` registra cada intento en `ai_api_logs` sin prompts ni claves.
- `AI_PROVIDER=fake` (por defecto; prohibido en producción): resultados deterministas `[Simulado]` con dominios `example.*`; respuestas con `@register_fake_response(Schema)`. Gemini maneja generación estructurada y Google Search grounding; Ollama, generación local estructurada. Si Gemini Search responde `429`, se buscan resultados reales en DuckDuckGo HTML (Wikipedia ES como refuerzo) y Gemini/Ollama sintetizan solo a partir de sus snippets, conservando URLs y spans citados. Este fallback no permite presentar conocimiento interno de Ollama como evidencia web.
- `create_app(settings, ai_provider=...)` permite inyectar un proveedor en tests.
- Orquestador (`research/orchestrator.py`): `POST /projects/{id}/research-runs` (202) crea el run `pending` y lanza `ResearchOrchestrator.run` con `BackgroundTasks` (sesión propia). Pasos: planificación (`ResearchPlan`) → búsquedas con grounding en paralelo (`AI_MAX_CONCURRENCY`; la sesión solo se usa desde el bucle). Guarda consultas, fuentes (upsert por URL canónica, `research/urls.py`), vínculos y evidencia `cited_claim` (spans validados).
- Estados: iniciar exige `structured|researching|analyzed` → `researching`; al completar queda `researching` (Fase 11 → `analyzed`); si falla → `structured`. Al arrancar, runs activos → `interrupted` (`RESEARCH_RECOVER_ON_STARTUP`; en tests `False` por defecto). Límite `RESEARCH_MAX_RUNS_PER_DAY` → 429.
- Prompts versionados en `research/prompts.py` (subir la versión al cambiarlos). Datos del usuario entre `<idea>...</idea>` y tratados como datos, no instrucciones.
- Paso `extracting` (Fase 10, `findings/extraction.py`): una llamada estructurada (`ExtractionResult`) con la evidencia numerada `[E#]`. Reglas: se DESCARTA todo hallazgo sin al menos una evidencia existente con postura `supports`; entidades solo si su nombre aparece en las respuestas (`entities/normalize.py` para deduplicar); confianza = nivel de la IA limitado por `findings/confidence.py` (1 dominio o evidencia en contra → máx. media). Si la extracción falla, el run queda `completed` con `error_code=extraction_failed`.
- Revisión (Fase 10): hallazgos y competidores de la IA se aceptan/rechazan (no se borran: 409 `ai_item_not_deletable`); editar su contenido los convierte en `origin=user` + `accepted`. Un competidor revisado o del usuario nunca lo sobrescribe una nueva investigación. Los hallazgos/competidores manuales son `origin=user`; la pertenencia de evidencias/entidades al proyecto se valida en el servicio. `get_owned_project()` en `projects/service.py` para módulos que cuelgan de un proyecto.
- Frontend: pestañas del proyecto (`features/projects/routes.tsx`: Idea / `investigacion` / `hallazgos` / `competidores` / `analisis` / `asistente` / `fuentes`); análisis en `features/analysis/` y chat en `features/chat/`. `features/research/`: polling cada 2 s mientras el run está activo; `CitedText` resalta solo spans con evidencia; enlaces externos solo http(s) (`safeHref`) y Search Suggestions en iframe sandbox.

- Chat (Fase 13): `POST /projects/{id}/chat`; `chat/service.py` reconstruye contexto limitado del proyecto y usa `AIOrchestrator` con `AIOperation.CHAT`. El historial del cliente es limitado y no se persiste; prompts/respuestas no se guardan en `ai_api_logs`. Los hallazgos citados se filtran por pertenencia al proyecto; el chat no ejecuta búsquedas web ni crea geodatos. Saludos breves se responden en backend sin consumir una llamada de IA.
- Reportes (Fase 14): `POST /projects/{id}/reports` inicia una versión en segundo plano y `GET /projects/{id}/reports[/{report_id}]` consulta su estado/contenido. Solo se genera sobre un proyecto analizado y la investigación completada más reciente. El informe distingue hechos, interpretaciones e incertidumbre, valida referencias H#/E#/S# contra el contexto y construye la sección de fuentes desde URLs guardadas; llamadas registradas como `report_generation`, sin prompts en logs. La exportación es Markdown y la impresión del navegador permite guardar PDF.
- Administración (`/admin`): módulo `app/modules/admin/` (`GET /api/v1/admin/overview`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}`) protegido con `AdminUser` (`403` para rol `user`). Expone métricas globales, rendimiento agregado por proveedor desde `ai_api_logs`, bitácora de las últimas 25 llamadas y gestión de cuentas (cambio de rol `user`/`admin` y activación/desactivación con revocación inmediata de `refresh_tokens`; impide auto-desactivación o auto-degradación). Frontend en `src/features/admin/AdminPage.tsx`.

## Base de datos (PostgreSQL 18 local, SQLAlchemy async + asyncpg, Alembic)
- `DATABASE_URL` y `TEST_DATABASE_URL` en `backend/.env` (ver `.env.example`). La BD de tests debe terminar en `_test`: se vacía en cada ejecución.
- Migraciones: `uv run alembic upgrade head` / `uv run alembic downgrade -1`.
- Nueva migración: `uv run alembic revision --autogenerate -m "..."` y REVISARLA a mano: autogenerate no detecta cambios en CHECK, ni triggers; toda tabla nueva con `updated_at` necesita su trigger `set_updated_at()`.
- Modelos por módulo en `app/modules/<modulo>/models.py`, registrados en `app/db/models.py`.
- Enums: `VARCHAR + CHECK` mediante `str_enum()` (`app/db/base.py`), nunca ENUM nativo. PK con `uuidv7()`.
- Sin `relationship()` por ahora (evita cargas implícitas en async); se añaden en la fase que las necesite.
- `tests/db/test_schema.py` verifica que modelos y migraciones coinciden (`compare_metadata`).
- `ai_api_logs`: la migración de Fase 12 conserva proveedores antiguos con etiqueta `legacy`, agrega `ollama` y costo estimado nullable; no atribuye registros históricos a otro proveedor.

## Autenticación (Fase 5)
- `SECRET_KEY` (>= 32 caracteres) obligatoria en `.env`. Access token JWT HS256 (30 min) + refresh token opaco rotativo (7 días, solo su SHA-256 en BD). Reusar un refresh ya rotado revoca todas las sesiones del usuario: el frontend debe serializar las llamadas a `/auth/refresh`.
- Dependencias en `app/api/deps.py`: `DbSession`, `AppSettings` (lee `app.state.settings`), `CurrentUser`, `AdminUser`.
- Límite de login en memoria (`app/core/rate_limit.py`): válido para un solo proceso.
- Autorización por propiedad: los servicios cargan el proyecto con `get_owned(project_id, user_id)` y responden 404 (nunca 403) si no es del usuario.
- Paginación `Page[T]` + `page_params`; PATCH con `PatchModel` (rechaza null explícito). Base en `app/core/schemas.py`.
- Helpers de tests de API en `tests/api/helpers.py` (`user_headers`, `registered_tokens`, ...).
- Tests con BD: fixtures `migrated_db`, `db_app`, `db_client`, `run_sql`, `fetch_scalar` en `tests/conftest.py`; tras cada test de API se hace `TRUNCATE users CASCADE`.
