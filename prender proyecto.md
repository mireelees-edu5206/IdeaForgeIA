# Guía Rápida para Prender el Proyecto — IdeaForge AI

Esta guía explica paso a paso cómo instalar y levantar **IdeaForge AI** en cualquier computadora del equipo (Windows / PowerShell).

---

## 1. Requisitos que debes tener instalados

Antes de prender el proyecto por primera vez, asegúrate de tener instalados:

1. **Python 3.13** y el gestor **`uv`**:
   ```powershell
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
2. **Node.js (v22 o superior)** y **npm**: [https://nodejs.org](https://nodejs.org)
3. **PostgreSQL 18** corriendo en el puerto `5432`: [https://www.postgresql.org/download/](https://www.postgresql.org/download/)
4. **Ollama** (para usar el modelo local gratis en CPU): [https://ollama.com/download](https://ollama.com/download)
   - Una vez instalado Ollama, descarga el modelo ejecutando en una terminal:
     ```powershell
     ollama pull qwen3:4b
     ```

---

## 2. Configuración de primera vez (Solo se hace una vez)

### Paso 2.1 — Crear las bases de datos en PostgreSQL
Abre **pgAdmin** o **`psql`** y crea la base de datos principal (`ideaforge`) y la de pruebas (`ideaforge_test`):

```sql
CREATE DATABASE ideaforge;
CREATE DATABASE ideaforge_test;
```

### Paso 2.2 — Configurar el archivo `backend/.env`
Dentro de la carpeta `backend/`, asegúrate de que exista el archivo `.env` (puedes copiar `backend/.env.example` a `backend/.env`) y ajusta tu usuario/contraseña de PostgreSQL:

```env
APP_ENV=development
DATABASE_URL=postgresql+asyncpg://postgres:TU_PASSWORD@localhost:5432/ideaforge
TEST_DATABASE_URL=postgresql+asyncpg://postgres:TU_PASSWORD@localhost:5432/ideaforge_test
SECRET_KEY=clave-secreta-local-de-al-menos-32-caracteres-seguros

# Proveedor de IA (ollama corre gratis en tu PC; gemini usa la nube)
AI_PROVIDER=ollama
AI_FALLBACK_PROVIDER=gemini
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b
OLLAMA_THINK=false
AI_TIMEOUT_SECONDS=240

# Opcional si tienes API Key de Google AI Studio:
GEMINI_API_KEY=TU_API_KEY_DE_GEMINI
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_SEARCH_GROUNDING_ENABLED=true

GEO_PROVIDER=openstreetmap
```

### Paso 2.3 — Instalar dependencias del Backend y crear las tablas
Abre una terminal **PowerShell** en la raíz del proyecto y ejecuta:

```powershell
cd backend
$env:UV_PROJECT_ENVIRONMENT = "$env:USERPROFILE\.venvs\ideaforge-backend"
uv sync
uv run alembic upgrade head
```
*(Nota: `$env:UV_PROJECT_ENVIRONMENT` guarda el entorno virtual fuera de OneDrive para que no se trabe ni sea lento).*

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

2. **«La investigación con Ollama tarda o dice que el proveedor no está disponible»**
   - Verifica que la app de **Ollama** esté abierta junto al reloj de Windows y que hayas descargado el modelo con:
     ```powershell
     ollama pull qwen3:4b
     ```

3. **«Quiero crear o promover mi usuario a Administrador para ver el panel `/admin`»**
   - Regístrate normalmente desde `http://localhost:5173/registro` y luego ejecuta en PostgreSQL:
     ```sql
     UPDATE users SET role = 'admin' WHERE email = 'tu_correo@ejemplo.com';
     ```
   - Recarga la página y aparecerá el botón **Admin** en la barra superior.
