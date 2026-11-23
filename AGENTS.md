# IdeaForge AI - notas del proyecto

Desarrollo incremental por fases: implementar solo la fase indicada por el usuario y esperar confirmación.
Estado verificado el 2026-11-13: pruebas backend 220 pasan, pruebas frontend 62 pasan (17 archivos), `npm run typecheck` sin errores.

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
Autenticación y usuarios; autenticación de aplicación migrada a Supabase Auth, con el rol de administrador conservado en la BD local.

### FASE 6 ✅
Gestión de proyectos e ideas.

### FASE 7 ✅
Frontend base con React + TypeScript + TailwindCSS.

### FASE 8 ✅
Dashboard y flujo principal de IdeaForge AI (confirmar estructura).

### FASE 9 ✅
Módulo de investigación y fuentes (orquestador, búsqueda pública con fuentes citadas).

### FASE 10 ✅
Hallazgos, entidades, competidores y evidencia (extracción y revisión).

### FASE 11 ✅
Oportunidades, riesgos, hipótesis e información faltante.
- ✅ Backend completo (modelos, servicio, router, runner)
- ✅ Frontend completo (`features/analysis/AnalysisTab.tsx` con los 4 cuadrantes, CRUD, aceptación/rechazo y trazabilidad hacia hallazgos y fuentes)

### FASE 12 ✅ (reemplazada por el motor propio)
Orquestador de IA (`AIOrchestrator`) con una interfaz común `AIProvider`.
- Se integraron Gemini y Ollama, pero después se retiraron del proyecto (commit `4e7a08f`, migración `d8a24b6e91c0`). Ya no existen `providers/gemini.py` ni `providers/ollama.py`.
- El proveedor activo es `engine`: el motor propio de IdeaForge en Python (`app/modules/ai/providers/engine.py`), sin APIs de modelos de lenguaje externos.
- Grok nunca se implementó y no debe agregarse.
- Los registros antiguos de `gemini`/`ollama` quedaron como `legacy` y no se pueden elegir como proveedor activo.

### FASE 13 ✅
Chatbot contextual (`POST /projects/{id}/chat`, `features/chat/ChatTab.tsx` con historial acotado y referencias verificables). Lo responde el motor propio.

### FASE 14 ✅
Generación de informes versionados por proyecto: borrador en segundo plano, síntesis estructurada, fuentes y evidencias rastreables, descarga Markdown e impresión a PDF.

### FASE 15 ✅
PWA, mapas, geolocalización, optimización y experiencia móvil.
- OpenStreetMap + Nominatim (geocodificación) + Overpass API (lugares/negocios) + Leaflet/react-leaflet (mapas en frontend).
- Geo Provider desacoplado (`GEO_PROVIDER=openstreetmap`) para permitir cambio de proveedor futuro.
- API geográfica autenticada con búsquedas manuales; Nominatim limitado a 1 req/s y caché, Overpass con radio/resultados acotados y caché.
- Mapa Leaflet en Competidores con búsqueda manual, ubicación del dispositivo bajo permiso explícito, categorías/radio, atribución y aviso de que los lugares mapeados no prueban competencia.
- Al generar el veredicto se consultan, si el usuario las indica, hasta tres zonas con OpenStreetMap; las referencias OSM quedan en las fuentes y su ausencia no se interpreta como ausencia de negocios.
- PWA instalable con manifiesto, pantalla offline y caché del shell/archivos estáticos. Nunca cachea `/api`, coordenadas, búsquedas o datos privados.

### FASE 16 ✅
Seguridad, pruebas y corrección de errores.
- Las respuestas de la API añaden `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Cache-Control: no-store`; pruebas en respuestas correctas y de error.
- El limitador de login limpia intentos vencidos y limita sus claves en memoria a 10 000 por ventana.
- Prueba de autorización: una entidad de un proyecto no puede vincularse desde otro proyecto.

### FASE 17 ⏸️ (en pausa por indicación del usuario)
Preparación para producción.
- Compartir el limitador de login entre procesos o réplicas (hoy vive en memoria de un solo proceso).
- Objetivo acordado: desplegar solamente el frontend; FastAPI y PostgreSQL permanecen en la computadora del usuario.
- El frontend publicado debe llamar a la API local mediante `VITE_API_URL` apuntando a un túnel HTTPS seguro. Para usarlo desde otros dispositivos, la computadora, el backend y el túnel deben permanecer encendidos y conectados.
- Vercel: importar el repositorio con raíz `frontend` y preset Vite; `frontend/vercel.json` redirige rutas SPA al shell. En Vercel configurar `VITE_API_URL` como la URL HTTPS del túnel más `/api/v1`, además de las variables públicas de Supabase.
- No abrir puertos del router; limitar CORS al dominio publicado y conservar la autenticación de la API.
- Proveedor de hosting del frontend y proveedor del túnel: por elegir antes de configurar el despliegue.

### Trabajo posterior a la Fase 16 (sin fase formal)
- Motor propio `engine` como único proveedor de IA (`4e7a08f`): búsqueda pública en DuckDuckGo y Wikipedia (ES), ranking TF-IDF con similitud coseno, extracción con reglas, razonamiento por reglas y predicción de viabilidad e inversión.
- Laboratorio de administración en `/admin/laboratorio` y `/admin/laboratorio/proposiciones` (`8b8f43b`): conserva BFS, Haversine, ruta exacta, vecino más cercano, presupuesto exacto y voraz, tablas de verdad y PEAS. Quita DFS, A*, búsqueda voraz de trazas, escalada, 2-opt, genético y calendario por turnos.
- Filtro de cifras atípicas por regla IQR al estimar la inversión inicial.
- Árbol de decisión en Python puro (`app/modules/ai/learning/`) que aprende si una persona aceptará o rechazará un hallazgo propuesto por la IA. Solo entrena con al menos 20 ejemplos aceptados y 20 rechazados. Hoy no se entrena: no hay hallazgos revisados todavía.
- Rediseño del frontend: nuevo fondo, paleta, logo y navegación (`ffc5b95`).
- Documentación de prácticas (`HECTOR.md`) y guía de arranque (`prender proyecto.md`) con el script `ideaforge_setup.sql` (crea el usuario `ideaforge`, las bases y la estructura sin datos).

## Backend (`backend/`)
- Python 3.13 gestionado con `uv`. El entorno virtual vive FUERA de OneDrive:
  `UV_PROJECT_ENVIRONMENT=C:\Users\bhera\.venvs\ideaforge-backend` (definirlo en cada sesión).
- `pyproject.toml` usa `exclude-newer` (solo paquetes con >= 7 días publicados).
- Comandos (desde `backend/`):
  - Dependencias: `uv sync` / `uv add <pkg>` / `uv add --dev <pkg>`
  - Servidor: `uv run uvicorn app.main:app --reload --reload-dir app --port 8000` (`--reload-dir app` evita reinicios cuando se ejecutan tests o cambia `.venv`)
  - Tests: `uv run pytest -q` (220 pasan; tarda unos 4 minutos)
  - Lint/format: `uv run ruff check .` y `uv run ruff format --check .`
- Errores de API siempre con formato `{"error": {"code", "message", "details?"}}` (`app/core/errors.py`).
- Routers montados bajo `/api/v1`: health, users, projects, research, findings, entities, analysis, chat, reports, geo y admin (con `admin/lab`).
- `/auth/*` y `/users/me/password` (autenticación local heredada) solo se montan si `LEGACY_AUTH_ENABLED=true`.

## Frontend (`frontend/`)
- React 19 + TypeScript 7 (estricto) + Vite 8 + Tailwind v4 (`@tailwindcss/vite`, tokens en `src/styles/index.css`) + React Router 7 + TanStack Query 5 + react-icons. Versiones exactas en `package.json`.
- Instalar dependencias nuevas con `npm install --before=<fecha de hace 7 días> --save-exact <pkg>`.
- Comandos (desde `frontend/`): `npm run dev` (http://localhost:5173, proxy `/api` → backend :8000), `npm run typecheck`, `npm test` (Vitest + Testing Library), `npm run build`.
- Estructura: `src/app` (router, providers), `src/components/ui` (sistema de diseño), `src/components/layout`, `src/features/<modulo>`, `src/lib` (apiClient, supabaseClient, queryClient).
- Módulos en `src/features/`: admin (incluye `lab/`), analysis, auth, chat, dashboard, findings, geo, projects, reports, research, settings, visualizations.
- Dirección visual (UI UX Pro Max): dashboard de investigación data-dense con navy/azul y ámbar, Fira Sans + Fira Code, modo claro `#f8fafc` y oscuro `#0b1220` (`document.documentElement.dataset.theme = "dark"`, `localStorage("ideaforge-theme")`). Navegación lateral en escritorio, barra inferior móvil; Cristal Líquido selectivo en chrome y controles, paneles de datos sólidos para priorizar legibilidad.
- Onboarding: el panel inicial de una cuenta sin proyectos muestra una ruta de 5 pasos y una sola acción principal; dentro de cada proyecto, los pasos principales quedan separados de las herramientas opcionales.
- En `/proyectos`, cada tarjeta tiene una acción de borrado confirmada; `/reportes` es el paso "Veredicto" y oculta los apartados técnicos hasta que el usuario pide ver el análisis completo.
- Los nombres/versiones de modelo solo aparecen en la bitácora administrativa; las pantallas de uso normal no muestran proveedores ni IDs internos de IA.
- El `<Canvas>` Three.js (`three@0.186.0`) continúa lazy-loaded en `Backdrop.tsx` (`ForgeCanvas.tsx`); no rediseñar ni eliminar su escena sin indicación. Las ondas de botón respetan movimiento reducido. Evitar `backdrop-filter` anidado o trabajo por cuadro en `pointermove`; no poner `opacity < 1` en `ForgeCanvas`, `-z-10` en `Backdrop` ni `transform-style: preserve-3d` en contenedores padre, pues rompen `backdrop-filter` en Chromium/Edge.
- Utilidades visuales propias: `glass`, `stage-3d`, `neo-raised`, `neo-inset`, `tilt-3d`, `fog-uncertain`, `filament-line`, `jelly`, `text-gradient`, `animate-fade-up`. Respetan `prefers-reduced-motion`.
- Todas las llamadas HTTP pasan por `apiRequest` (`src/lib/apiClient.ts`): añade el access token de Supabase, convierte errores en `ApiError` y renueva la sesión con el SDK de Supabase.
- Nunca usar `dangerouslySetInnerHTML` con contenido de la API/IA (tokens en localStorage).
- Textos de la interfaz directamente en español. Etiquetas de enums del backend en `src/features/projects/constants.ts`.
- Datos del servidor con TanStack Query: claves en `projectKeys` (`src/features/projects/queries.ts`); cada mutación invalida `["projects"]`.
- Tests: `renderRoutes` + `apiRoutes` (`src/test/render.tsx`) para simular la API por método y ruta.
- Rutas: `/`, `/proyectos` (`?estado=&pagina=`), `/proyectos/nuevo`, `/configuracion` (cuenta, correo, selector de tema claro/oscuro, instalación PWA y cerrar sesión), `/admin` (exclusivo `role === "admin"`, protegido con `RequireAdmin`), `/admin/laboratorio`, `/admin/laboratorio/proposiciones` (también solo admin), `/proyectos/:projectId` (+ `/investigacion`, `/hallazgos`, `/competidores`, `/analisis`, `/asistente`, `/fuentes`, `/visualizaciones`, `/reportes` —veredicto final—), `/iniciar-sesion`, `/registro`.
- Si Vitest falla con "Timeout waiting for worker to respond", es el arranque lento en OneDrive: reintentar.

## Flujo de proyecto (Fase 8)
- `draft` → `structured` solo con `POST /projects/{id}/confirm-structure`: exige problema, solución y segmento con al menos un valor confirmado y ninguna sugerencia de IA pendiente (`check_structure` en `projects/service.py`).
- Editar `raw_idea` o cualquier atributo lo devuelve a `draft` desde cualquier estado (el título no). Con una investigación activa, editar la idea/atributos o borrar el proyecto da 409 `research_in_progress`.

## IA e investigación (Fases 9 a 14, con motor propio)
- Capa de IA en `app/modules/ai/`: interfaz `AIProvider`, `AIOrchestrator`, `factory.py` (`build_ai_provider`), tipos y errores neutrales. El proveedor `engine` vive en `providers/engine.py` y la búsqueda pública en `providers/web_search.py`. `providers/fake.py` es el proveedor de pruebas.
- `timed_call` + `build_call_logs` registra cada intento en `ai_api_logs` sin prompts ni claves.
- `AI_PROVIDER` (por defecto en código: `fake`; en `.env.example`: `engine`). `fake` está prohibido en producción y devuelve resultados deterministas `[Simulado]` con dominios `example.*`. Respuestas de prueba con `@register_fake_response(Schema)`.
- `create_app(settings, ai_provider=...)` permite inyectar un proveedor en tests.
- Búsqueda: DuckDuckGo HTML (`kl=mx-es`) y Wikipedia ES como refuerzo. El motor puntúa oraciones con TF-IDF + similitud coseno frente a la consulta, sintetiza afirmaciones con citas (`CitationSpan`) y valida los spans. No presentar conocimiento interno del motor como evidencia web.
- Orquestador (`research/orchestrator.py`): `POST /projects/{id}/research-runs` (202) crea el run `pending` y lanza `ResearchOrchestrator.run` con `BackgroundTasks` (sesión propia). Pasos: planificación (`ResearchPlan`) → búsquedas en paralelo (`AI_MAX_CONCURRENCY`; la sesión solo se usa desde el bucle). Guarda consultas, fuentes (upsert por URL canónica, `research/urls.py`), vínculos y evidencia `cited_claim` (spans validados).
- Estados: iniciar exige `structured|researching|analyzed` → `researching`; al completar queda `researching` (el análisis de Fase 11 pasa a `analyzed`); si falla → `structured`. Al arrancar, runs activos → `interrupted` (`RESEARCH_RECOVER_ON_STARTUP`, por defecto `true`; en tests se desactiva). Límite `RESEARCH_MAX_RUNS_PER_DAY` → 429. Máximo de preguntas: `RESEARCH_MAX_QUESTIONS` (3 a 15).
- Prompts versionados en `research/prompts.py` (subir la versión al cambiarlos). Datos del usuario entre `<idea>...</idea>` y tratados como datos, no instrucciones.
- Paso `extracting` (Fase 10, `findings/extraction.py`): el motor produce `ExtractionResult` con la evidencia numerada `[E#]`. Reglas: se DESCARTA todo hallazgo sin al menos una evidencia existente con postura `supports`; entidades solo si su nombre aparece en las respuestas (`entities/normalize.py` para deduplicar); confianza = nivel del motor limitado por `findings/confidence.py` (1 dominio o evidencia en contra → máx. media). Si la extracción falla, el run queda `completed` con `error_code=extraction_failed`.
- Revisión (Fase 10): hallazgos y competidores de la IA se aceptan/rechazan (no se borran: 409 `ai_item_not_deletable`); editar su contenido los convierte en `origin=user` + `accepted`. Un competidor revisado o del usuario nunca lo sobrescribe una nueva investigación. Los hallazgos/competidores manuales son `origin=user`; la pertenencia de evidencias/entidades al proyecto se valida en el servicio. `get_owned_project()` en `projects/service.py` para módulos que cuelgan de un proyecto.
- Frontend: pestañas del proyecto (`features/projects/routes.tsx`: Idea / `investigacion` / `hallazgos` / `competidores` / `analisis` / `asistente` / `fuentes` / `visualizaciones` / `reportes`); análisis en `features/analysis/` y chat en `features/chat/`. `features/research/`: polling cada 2 s mientras el run está activo; `CitedText` resalta solo spans con evidencia; enlaces externos solo http(s) (`safeHref`) y Search Suggestions en iframe sandbox.
- Chat (Fase 13): `POST /projects/{id}/chat`; `chat/service.py` reconstruye contexto limitado del proyecto y usa `AIOrchestrator` con `AIOperation.CHAT`. El historial del cliente es limitado y no se persiste; prompts/respuestas no se guardan en `ai_api_logs`. Los hallazgos citados se filtran por pertenencia al proyecto; el chat no ejecuta búsquedas web ni crea geodatos. Saludos breves se responden en backend sin llamar al motor.
- Reportes y veredicto (Fase 14): `POST /projects/{id}/reports` (202) inicia un análisis en segundo plano y `GET /projects/{id}/reports[/{report_id}]` consulta el resultado. El veredicto estructurado recomienda probar, validar más, no avanzar todavía o declara datos insuficientes; solo estima inversión con referencias de costos/precios y no promete éxito. Compara hasta tres zonas solicitadas, guarda el veredicto en `report_sections.verdict` (JSONB) y cita lugares OSM con referencias `G#`. El detalle completo queda plegado debajo del veredicto; exportación Markdown e impresión a PDF.
- Si cambia el esquema del veredicto (`BusinessVerdict`, `InvestmentEstimate`, `ZoneRecommendation` en `reports/schemas.py`), revisar `_predict_report_verdict` en `providers/engine.py`.
- Investigación de la inversión: el motor descarta cifras atípicas con la regla IQR (`_drop_outliers_iqr`, `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]`) y solo filtra si hay al menos 4 cifras.

## Laboratorio y aprendizaje (solo administración)
- Módulo `app/modules/admin/lab/` montado en `/api/v1/admin/lab/...` (protegido con `AdminUser`). Endpoints: `GET /metrics`, `GET /propositions`, `GET /learning`, `GET /projects`, `GET /projects/{id}/trace`, `POST /projects/{id}/trace/path`, `POST /projects/{id}/places`, `POST /projects/{id}/route`, `POST /projects/{id}/budget-plan`.
- Algoritmos conservados en `admin/lab/algorithms.py`: `find_trace_path` (BFS), `haversine_km`, `optimize_project_place_route` (método exacto para hasta 8 paradas y vecino más cercano), `optimize_hypothesis_budget` (exacto y voraz). Los removidos están listados en `HECTOR.md`.
- Árbol de decisión (`app/modules/ai/learning/decision_tree.py`): CART en Python puro con impureza de Gini, `max_depth=3`, `min_samples_leaf=3`. `evaluation.py` separa 60 % entrenamiento, 20 % validación y 20 % prueba con semilla fija. `report.py` exige `MIN_PER_CLASS = 20` aceptados y rechazados; si no, muestra solo la compuerta de datos. Pruebas: `tests/test_learning.py` y `tests/api/test_admin_lab.py`.
- Estado de datos: 0 hallazgos de la IA revisados (hay 4 propuestos pendientes). El árbol no entrena todavía y no modifica lo que ve la persona; solo informa.
- Bosque aleatorio y KNN no se usan (con los datos actuales no aportan; la distancia euclidiana no es adecuada para coordenadas).

## Administración (`/admin`)
- Módulo `app/modules/admin/` (`GET /api/v1/admin/overview`, `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}`, `DELETE /api/v1/admin/users/{id}`) protegido con `AdminUser` (`403` para rol `user`). La eliminación permanente requiere confirmación, no permite borrar la propia cuenta ni eliminar mientras haya tareas activas y protege la última cuenta administradora; proyectos/sesiones se eliminan en cascada y los registros de uso de IA conservan métricas sin identidad. Frontend en `src/features/admin/AdminPage.tsx`.

## Base de datos (PostgreSQL 18 local, SQLAlchemy async + asyncpg, Alembic)
- Usuario de la aplicación `ideaforge` (no superusuario, sin `CREATEDB`). Script de primera vez: `ideaforge_setup.sql` (crea usuario, bases `ideaforge_dev` e `ideaforge_test`, estructura sin datos). Ejecutar con `psql -U postgres -f ideaforge_setup.sql`.
- `DATABASE_URL` y `TEST_DATABASE_URL` en `backend/.env` (ver `.env.example`). La BD de tests debe terminar en `_test`: se vacía en cada ejecución.
- Migraciones en `backend/alembic/versions/`, cabeza actual `d8a24b6e91c0`. Comandos: `uv run alembic upgrade head` / `uv run alembic downgrade -1`.
- Nueva migración: `uv run alembic revision --autogenerate -m "..."` y REVISARLA a mano: autogenerate no detecta cambios en CHECK, ni triggers; toda tabla nueva con `updated_at` necesita su trigger `set_updated_at()`.
- Modelos por módulo en `app/modules/<modulo>/models.py`, registrados en `app/db/models.py`. Hay 25 tablas de dominio más `alembic_version` (26 en total en `public`) y 33 llaves foráneas. Los reportes guardan hasta tres zonas consultadas y el veredicto estructurado en JSONB. `users.supabase_user_id` vincula cuentas de Supabase con perfiles locales.
- Enums: `VARCHAR + CHECK` mediante `str_enum()` (`app/db/base.py`), nunca ENUM nativo. PK con `uuidv7()`. Los valores de `app/core/enums.py` se guardan en la base: cambiarlos exige migración.
- Sin `relationship()` por ahora (evita cargas implícitas en async); se añaden en la fase que las necesite.
- `tests/db/test_schema.py` verifica que modelos y migraciones coinciden (`compare_metadata`).
- Migraciones aplicadas en orden: `a1b3ade021f1` (esquema inicial), `95f14ef1a15d` (Ollama y costo estimado), `3f9c5a1b2d4e` (veredicto de informe), `c2149f7d8a31` (vínculo con Supabase), `d8a24b6e91c0` (motor propio: `gemini`/`ollama` pasan a `legacy`; la restricción acepta `engine`, `fake`, `legacy`).
- `ai_api_logs`: registros antiguos de proveedores externos quedan como `legacy`; no se atribuyen a otro proveedor.

## Autenticación (Fase 5)
- Supabase Auth se usa en frontend mediante `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Email/password y OAuth Google se envían directamente a Supabase; el registro espera confirmación de correo cuando está habilitada en Supabase.
- Backend: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_JWT_SECRET` (solo para tokens HS256 del secreto legado). Para las claves asimétricas actuales, `SupabaseTokenVerifier` valida por JWKS en `SUPABASE_URL/auth/v1/.well-known/jwks.json`; `SUPABASE_JWKS_URL` permite sobrescribirlo.
- Después de validar firma, `iss`, `aud`, expiración y `role=authenticated`, el backend consulta `/auth/v1/user` para comprobar el correo confirmado. Solo acepta la excepción Google si Supabase identifica un proveedor/identidad Google. El estado se almacena en caché brevemente.
- `CurrentUser` vincula el `sub` de Supabase a `users.supabase_user_id`; una coincidencia con correo confirmado enlaza una cuenta existente y conserva su rol/proyectos. Una cuenta nueva recibe rol `user`; solo `User.role` local concede acceso admin.
- `/` es público; `/perfil`, `/api/v1/perfil` y `/api/v1/users/me` requieren Bearer válido. Los endpoints locales heredados `/auth/*` y `/users/me/password` no se montan salvo `LEGACY_AUTH_ENABLED=true` (pruebas o migración controlada).
- La eliminación admin también elimina la identidad de Supabase. `SUPABASE_SERVICE_ROLE_KEY` es obligatoria para esa operación y solo se configura en el backend; nunca va al frontend.
- Dependencias de auth: PyJWT + cryptography para firma/JWKS; el SDK de Supabase se usa en el frontend, no hace falta el SDK Python para verificar JWT.
- Dependencias en `app/api/deps.py`: `DbSession`, `AppSettings` (lee `app.state.settings`), `CurrentUser`, `AdminUser`.
- Límite de login en memoria (`app/core/rate_limit.py`): limpia claves vencidas y mantiene un máximo de 10 000 claves por ventana; sigue siendo válido solo para un proceso.
- Autorización por propiedad: los servicios cargan el proyecto con `get_owned(project_id, user_id)` y responden 404 (nunca 403) si no es del usuario.
- Paginación `Page[T]` + `page_params`; PATCH con `PatchModel` (rechaza null explícito). Base en `app/core/schemas.py`.
- Helpers de tests de API en `tests/api/helpers.py` (`user_headers`, `registered_tokens`, ...).
- Tests con BD: fixtures `migrated_db`, `db_app`, `db_client`, `run_sql`, `fetch_scalar` en `tests/conftest.py`; tras cada test de API se hace `TRUNCATE users CASCADE`.

## Configuración relevante (`backend/.env`)
- `APP_ENV`, `LOG_LEVEL`, `CORS_ORIGINS`, `LEGACY_AUTH_ENABLED=false`, `DATABASE_URL`, `TEST_DATABASE_URL`.
- Supabase: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL`.
- Login: `LOGIN_MAX_FAILED_ATTEMPTS=5`, `LOGIN_LOCKOUT_SECONDS=900`.
- IA: `AI_PROVIDER=engine`, `AI_ENGINE_MODEL=ideaforge-engine-v1`, `AI_TIMEOUT_SECONDS`, `AI_MAX_CONCURRENCY=3`, `AI_FAKE_LATENCY_MS` (solo `fake`).
- Geo: `GEO_PROVIDER=openstreetmap`, `GEO_NOMINATIM_URL`, `GEO_OVERPASS_URL`, `GEO_USER_AGENT`.
- Investigación: `RESEARCH_MAX_QUESTIONS=8`, `RESEARCH_MAX_RUNS_PER_DAY=10`, `RESEARCH_RECOVER_ON_STARTUP`.
- Ya no existen `GEMINI_API_KEY`, `OLLAMA_BASE_URL` ni `OLLAMA_MODEL`.
