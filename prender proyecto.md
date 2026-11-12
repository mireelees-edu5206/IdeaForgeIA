# Guía Rápida para Prender el Proyecto — IdeaForge AI

Esta guía explica paso a paso cómo instalar y levantar **IdeaForge AI** en cualquier computadora del equipo (Windows / PowerShell).

La inteligencia artificial del proyecto es el **motor propio de IdeaForge en Python**. No necesita Ollama, Gemini ni ninguna otra cuenta de IA. Sí necesita conexión a internet, porque busca información pública en DuckDuckGo y Wikipedia.

---

## 1. Requisitos que debes tener instalados

Antes de prender el proyecto por primera vez, asegúrate de tener instalados:

1. **Python 3.13** y el gestor **`uv`**:
   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
2. **Node.js (v22 o superior)** y **npm**: [https://nodejs.org](https://nodejs.org)
3. **PostgreSQL 18** corriendo en el puerto `5432`, con `psql` incluido: [https://www.postgresql.org/download/](https://www.postgresql.org/download/)
   - Por defecto `psql` queda en `C:\Program Files\PostgreSQL\18\bin`. Si el comando `psql` no se reconoce, usa la ruta completa.

---

## 2. Configuración de primera vez (Solo se hace una vez)

### Paso 2.1 — Crear el usuario, las bases y la estructura (un solo script)

El archivo **`ideaforge_setup.sql`** está en la raíz del proyecto. En un solo paso crea:

- El usuario `ideaforge` de la aplicación (no es superusuario).
- Las bases `ideaforge_dev` (desarrollo) e `ideaforge_test` (pruebas), propiedad de `ideaforge`.
- Toda la estructura de tablas, índices y triggers, **sin datos**.

**Antes de ejecutarlo:** abre `ideaforge_setup.sql` y cambia `CAMBIAR_ESTA_CONTRASENA` por una contraseña propia (aparece una sola vez, en la línea `CREATE ROLE`).

Luego abre PowerShell en la carpeta donde está el archivo y ejecuta:

```powershell
psql -U postgres -f ideaforge_setup.sql
```

- `psql` te pedirá la contraseña del superusuario `postgres` (la que definiste al instalar PostgreSQL).
- Si ves `ERROR`, detente y avisa al responsable del proyecto. Las bases no se borran solas.
- Si el script ya se ejecutó antes, fallará en `CREATE DATABASE` porque las bases existen. No lo repitas sin revisar primero.

### Paso 2.2 — Configurar el archivo `backend/.env`

Dentro de la carpeta `backend/`, copia `backend/.env.example` a `backend/.env` y ajusta los valores:

```env
APP_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173
LEGACY_AUTH_ENABLED=false

DATABASE_URL=postgresql+asyncpg://ideaforge:CAMBIAR_ESTA_CONTRASENA@localhost:5432/ideaforge_dev
TEST_DATABASE_URL=postgresql+asyncpg://ideaforge:CAMBIAR_ESTA_CONTRASENA@localhost:5432/ideaforge_test

# Autenticación con Supabase: pide estos valores al responsable del proyecto
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
SUPABASE_JWT_SECRET=

# Motor propio de IA (no requiere API keys ni servidores externos)
AI_PROVIDER=engine
AI_ENGINE_MODEL=ideaforge-engine-v1

GEO_PROVIDER=openstreetmap
```

- Reemplaza `CAMBIAR_ESTA_CONTRASENA` por la misma contraseña que pusiste en `ideaforge_setup.sql`.
- **Nunca subas `backend/.env` a GitHub.** Ya está ignorado por Git.

### Paso 2.3 — Instalar dependencias del Backend

Abre una terminal **PowerShell** en la raíz del proyecto y ejecuta:

```powershell
cd backend
$env:UV_PROJECT_ENVIRONMENT = "$env:USERPROFILE\.venvs\ideaforge-backend"
uv sync
```

- *(Nota: `$env:UV_PROJECT_ENVIRONMENT` guarda el entorno virtual fuera de OneDrive para que no se trabe ni sea lento).*
- El script ya dejó registrada la versión de Alembic. No hace falta correr migraciones.

### Paso 2.4 — Instalar dependencias del Frontend

En otra terminal **PowerShell** desde la raíz del proyecto:

```powershell
cd frontend
npm install
```

---

## 3. Cómo prender el proyecto todos los días (2 Terminales)

Para trabajar con el proyecto necesitas tener **2 terminales abiertas al mismo tiempo** (una para el Backend y otra para el Frontend):

### Terminal 1 — Prender el Backend (Puerto `8000`)
Abre PowerShell en la carpeta del proyecto y pega estos 3 comandos:

```powershell
cd backend
$env:UV_PROJECT_ENVIRONMENT = "$env:USERPROFILE\.venvs\ideaforge-backend"
uv run uvicorn app.main:app --reload --reload-dir app --port 8000
```
- Cuando veas `Application startup complete.`, el backend ya está listo en:
  - API: `http://127.0.0.1:8000/api/v1`
  - Documentación Swagger: `http://127.0.0.1:8000/docs`

---

### Terminal 2 — Prender el Frontend (Puerto `5173`)
Abre una **segunda ventana de PowerShell** en la carpeta del proyecto y ejecuta:

```powershell
cd frontend
npm run dev
```
- Abre tu navegador en: **`http://localhost:5173`**

---

## 4. Cómo apagar el proyecto
- En cada una de las 2 terminales presiona **`Ctrl + C`**.

---

## 5. Solución de problemas comunes del equipo

1. **«Al correr `uv sync` o `uvicorn` marca error de permisos o tarda mucho en OneDrive»**
   - Siempre ejecuta primero:
     ```powershell
     $env:UV_PROJECT_ENVIRONMENT = "$env:USERPROFILE\.venvs\ideaforge-backend"
     ```
     antes de cualquier comando `uv ...` en una terminal nueva.

2. **«La investigación tarda, no encuentra fuentes o el veredicto sale vacío»**
   - El motor busca en internet. Revisa tu conexión y que puedas abrir `https://duckduckgo.com` y `https://es.wikipedia.org` desde el navegador.
   - Si el problema continúa, revisa la terminal del backend: los errores aparecen ahí.

3. **«Dice que faltan tablas o columnas»**
   - La base no se cargó bien. Borra `ideaforge_dev` y `ideaforge_test` (con `DROP DATABASE ideaforge_dev;` y `DROP DATABASE ideaforge_test;` en `psql`) y vuelve a ejecutar el **Paso 2.1**.
   - Borrar una base elimina todos sus datos. Hazlo solo en tu computadora y solo si no tienes datos que conservar.

4. **«Quiero crear o promover mi usuario a Administrador para ver el panel `/admin`»**
   - Regístrate normalmente desde `http://localhost:5173/registro` y luego ejecuta en PostgreSQL:
     ```sql
     UPDATE users SET role = 'admin' WHERE email = 'tu_correo@ejemplo.com';
     ```
   - Recarga la página y aparecerá el botón **Admin** en la barra superior.
