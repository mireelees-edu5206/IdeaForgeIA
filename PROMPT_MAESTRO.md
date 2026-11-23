# PROMPT MAESTRO — IDEAFORGE AI

Actúa como un arquitecto de software, desarrollador Full Stack Senior y especialista en sistemas de inteligencia artificial, con experiencia en React, TypeScript, Python, FastAPI, PostgreSQL, Supabase Auth, procesamiento de lenguaje natural clásico, datos geográficos abiertos, seguridad, UX/UI y desarrollo de aplicaciones web modernas.

Tu función es reconstruir desde cero un proyecto completo llamado:

# IdeaForge AI

---

## 0. OBJETIVO DE ESTE PROMPT Y CÓMO USARLO

Este documento se entrega a una IA que debe construir IdeaForge AI desde cero hasta **exactamente el estado actual** descrito aquí. No es un proyecto de prueba: el resultado debe quedar funcional, verificado y con las mismas decisiones.

Reglas para esta reconstrucción:

1. Lee el documento completo antes de escribir código.
2. Construye en el orden de las fases (sección 31). Cada fase debe quedar verificada antes de pasar a la siguiente.
3. El estado final debe cumplir los criterios de aceptación del Anexo F: migración en `d8a24b6e91c0`, 220 pruebas de backend en verde, 62 pruebas de frontend en verde, `typecheck`, `ruff`, `build` sin errores.
4. Si una decisión de este documento contradice otra fuente, prevalece este documento. Si algo no está especificado, no lo inventes: escribe "Pendiente de confirmar" y explica la duda.
5. Lo que aparece como **PROPUESTA** no debe implementarse en esta reconstrucción; solo debe documentarse.
6. Lo que aparece como **RETIRADO** no debe existir en el código ni en la configuración.

---

## 1. ¿QUÉ ES IDEAFORGE AI?

IdeaForge AI es una plataforma web para analizar, investigar, evaluar y validar ideas de negocio mediante inteligencia artificial y evidencia obtenida de diferentes fuentes.

El usuario introduce una idea de negocio y el sistema lo ayuda a estructurarla y, después, a investigarla.

La plataforma analiza aspectos como:

- Problema que intenta resolver.
- Solución propuesta.
- Segmento de clientes.
- Producto o servicio.
- Canales.
- Modelo de ingresos.
- Ubicación o alcance geográfico.
- Diferenciadores declarados.
- Tecnologías relevantes.
- Competidores directos.
- Competidores indirectos.
- Productos o servicios sustitutos.
- Alternativas existentes.
- Oportunidades.
- Riesgos.
- Hipótesis que necesitan validación.
- Información que todavía falta.
- Evidencia encontrada.
- Fuentes utilizadas.
- Nivel de confianza de determinados hallazgos.
- Incertidumbre existente.
- Información geográfica relevante.
- Competencia localizada físicamente.

El objetivo NO es simplemente preguntarle a una IA:

"¿Mi idea de negocio es buena?"

La plataforma realiza un proceso estructurado de investigación y análisis.

El resultado debe permitir al usuario comprender:

**qué se encontró → de dónde salió → qué significa → qué tan confiable es → qué falta investigar → qué debería validar.**

El veredicto final tiene cuatro salidas posibles: **probar**, **validar más**, **no avanzar todavía** o **datos insuficientes**. Nunca promete éxito.

---

## 2. PRINCIPIO FUNDAMENTAL DEL SISTEMA

IdeaForge AI debe diferenciar claramente entre:

### Datos

Información almacenada o introducida por el usuario.

### Hallazgos

Información encontrada durante la investigación.

### Evidencia

Fragmentos o datos que respaldan un determinado hallazgo.

### Fuentes

Sitios o recursos de donde procede la información.

### Análisis

Interpretación realizada por el sistema o por el motor de IA.

### Hipótesis

Suposiciones que todavía necesitan ser comprobadas.

### Incertidumbre

Información que no puede determinarse con suficiente confianza.

### Resultados

Conclusiones generadas a partir de la información disponible.

Nunca presentes una conclusión generada por IA como si fuera un hecho comprobado.

Cuando algo sea una interpretación, debe identificarse como análisis o interpretación.

Cuando algo no pueda comprobarse, debe indicarse como incierto.

Este principio también aplica a la información geográfica.

Por ejemplo:

**Dato:**
"Se encontraron 14 cafeterías en la zona."

**Interpretación:**
"Existe una posible concentración competitiva."

**Conclusión:**
"Se requiere mayor evidencia para determinar el nivel real de competencia."

La existencia de un establecimiento en OpenStreetMap no significa automáticamente que sea un competidor directo.

---

## 3. INTELIGENCIA ARTIFICIAL — ARQUITECTURA ACTUAL

**IMPORTANTE**

La arquitectura original contemplaba Gemini API y Grok API. Esto quedó modificado oficialmente:

- **Grok está fuera del proyecto.** NO implementar Grok. NO agregar dependencias, configuración ni proveedor alternativo de Grok. NO asumir que será necesario pagar por una segunda API comercial.
- **Gemini API está RETIRADO.** Se integró en la fase 12 y después se retiró. NO agregar `GEMINI_API_KEY`, dependencias de Gemini ni llamadas a Google Search.
- **Ollama está RETIRADO.** Se integró en la fase 12 y después se retiró. NO agregar `OLLAMA_BASE_URL` ni `OLLAMA_MODEL`.

La arquitectura actual de IA es el **motor propio de IdeaForge en Python**, configurado con `AI_PROVIDER=engine`. Es un motor programado en Python que no depende de APIs externas de modelos de lenguaje. Implementa:

- Procesamiento de lenguaje natural clásico: tokenización, palabras vacías en español, TF-IDF y similitud coseno.
- Búsqueda pública en DuckDuckGo (resultados HTML) y, como refuerzo, Wikipedia en español.
- Extracción de hallazgos, entidades y competidores con reglas explícitas.
- Razonamiento por encadenamiento hacia adelante (forward chaining) sobre evidencia y hallazgos.
- Predicción de viabilidad e inversión, con filtro de cifras atípicas.
- Respuestas del chat mediante ranking léxico BM25/TF-IDF sobre el contexto del proyecto.

La aplicación debe diseñarse mediante una abstracción de proveedores para que el resto del backend no dependa directamente de un proveedor concreto.

La arquitectura conceptual es:

```
AI Provider
│
├── Engine Provider (motor propio de IdeaForge, activo)
│
└── Fake Provider (solo pruebas; prohibido en producción)
```

El resto del backend deberá comunicarse mediante una interfaz común. En la implementación, la interfaz del proveedor tiene dos métodos: `generate_structured(...)` y `generate_grounded(...)` (`app/modules/ai/providers/base.py`). Las operaciones de negocio se identifican con `AIOperation`: `idea_structuring`, `research_planning`, `grounded_search`, `extraction`, `analysis`, `report_generation` y `chat`.

El proveedor concreto puede cambiarse mediante configuración:

```
AI_PROVIDER=engine
```

Solo para pruebas:

```
AI_PROVIDER=fake
```

El valor por defecto en el código es `fake`; el archivo `.env.example` define `engine`. En `APP_ENV=production`, `fake` debe rechazarse al arrancar.

---

## 4. MOTOR PROPIO Y SECRETOS

El motor propio no requiere claves de API ni servidores de IA externos.

Aun así, cualquier integración futura con un servicio que sí requiera claves debe respetar estas reglas. La integración debe realizarse exclusivamente desde el backend.

**Nunca:**

```
React
↓
Servicio externo
```

**Siempre:**

```
React
↓
FastAPI
↓
AI Provider / Adaptador
↓
Servicio externo
```

Las claves de un servicio externo:
- Nunca deben estar en React.
- Nunca deben estar en TypeScript.
- Nunca deben estar en Git.
- Nunca deben escribirse directamente en el código.
- Nunca deben enviarse al frontend.

Deben cargarse desde variables de entorno en `backend/.env`.

Las claves del backend que existen hoy son las de Supabase (`SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_JWT_SECRET`, ambas solo en backend). La clave publicable de Supabase sí puede estar en el frontend.

---

## 5. LÍMITES DE SERVICIOS EXTERNOS

La búsqueda pública (DuckDuckGo y Wikipedia), Nominatim y Overpass son servicios externos con límites de uso. Aunque no requieren clave, pueden limitar peticiones.

**IMPORTANTE:**

- NO asumir que todos los servicios tienen los mismos límites.
- NO asumir que son gratuitos sin límite.
- NO asumir que el acceso es ilimitado.

Los límites pueden incluir:
- Peticiones por segundo.
- Peticiones por minuto o por día.
- Bloqueos temporales por frecuencia.

El sistema debe manejar errores de cuota o de rate limit.

Por ejemplo:

```
429 Too Many Requests
```

debe manejarse correctamente y no debe provocar que la aplicación se rompa.

---

## 6. REINICIO DE LÍMITES

Los límites de los servicios externos se reinician según las condiciones de cada servicio.

Por lo tanto:

- NO almacenar en la aplicación que una cuota diaria es permanente.
- NO asumir que, al alcanzar un límite, el servicio queda inutilizable permanentemente.

El sistema debe diferenciar entre:
- límite por segundo o por minuto;
- límite por día;
- errores temporales;
- errores de autenticación;
- errores del proveedor;
- errores internos.

Cuando sea posible, mostrar al usuario un mensaje comprensible como:

"Se alcanzó temporalmente el límite de búsqueda pública. Puedes intentar nuevamente más tarde."

No mostrar errores técnicos innecesarios al usuario final.

Los límites propios de la aplicación son: `RESEARCH_MAX_RUNS_PER_DAY` (investigaciones por usuario cada 24 horas; excederlo responde 429) y el limitador de intentos de inicio de sesión (sección 7).

---

## 7. BÚSQUEDA WEB E INFORMACIÓN ACTUAL

IdeaForge AI necesita trabajar con información que cambia con el tiempo: competidores actuales, negocios existentes, precios, tendencias, productos, servicios, información de mercado, sitios web e información pública reciente.

El motor obtiene esta información mediante búsqueda pública:

- **DuckDuckGo** (`html.duckduckgo.com`, región `mx-es`): los enlaces redirigidos (`uddg=`) se resuelven a su dirección real antes de guardarse.
- **Wikipedia en español** (`es.wikipedia.org`): refuerzo cuando DuckDuckGo no devuelve resultados útiles.

Cada afirmación encontrada conserva la URL de su fuente y el fragmento citado con su posición exacta (`span`).

Sin embargo:

- NO asumir que cualquier operación del motor consulta Internet: solo las búsquedas lo hacen.
- NO presentar información actual como si hubiera sido investigada en Internet si no se realizó una búsqueda.
- NO presentar el conocimiento interno del motor como evidencia web.

La arquitectura debe separar claramente:

**Motor sin búsqueda**

de:

**Motor + búsqueda pública con fuentes citadas**

Cuando se utilice información obtenida mediante búsqueda, debe conservarse la referencia a la fuente siempre que sea técnicamente posible.

---

## 8. INVESTIGACIÓN WEB DE IDEAFORGE

La investigación de IdeaForge NO debe depender exclusivamente de que el motor "sepa" la información.

La arquitectura debe seguir este flujo:

```
Usuario
↓
Idea de negocio
↓
Generación de consultas (planificación)
↓
Fuentes externas (búsqueda pública)
↓
Hallazgos
↓
Evidencia
↓
Base de datos
↓
Motor IdeaForge (extracción y razonamiento)
↓
Análisis
```

El objetivo es que el motor analice información recopilada y no invente datos.

La plataforma conserva:
- URL.
- Fuente.
- Fecha de consulta.
- Consulta realizada.
- Fragmento relevante.
- Datos encontrados.
- Nivel de confianza.

Esto se integra con las tablas:

```
sources
research_queries
findings
evidence
```

---

## 9. OLLAMA — RETIRADO

Ollama se integró en la fase 12 como proveedor local y después se retiró. El motor propio de IdeaForge cubre su función.

**IMPORTANTE:**

- NO reintroducir Ollama, `OLLAMA_BASE_URL` ni `OLLAMA_MODEL`.
- Si en el futuro se agrega un modelo local, debe entrar como nuevo proveedor detrás de la interfaz común, con el modelo configurable y sin estar escrito rígidamente en la aplicación.
- Antes de agregarlo, deben evaluarse RAM, CPU, GPU, VRAM, rendimiento y calidad requerida del equipo.

---

## 10. ¿QUÉ PROCESAMIENTO USA CADA SOLICITUD?

No todas las tareas deben ejecutarse igual. La arquitectura debe decidir qué procesamiento utilizar.

Ejemplo conceptual:

```
Solicitud
    ↓
AI Orchestrator
    ↓
¿Necesita información actual de Internet?
    │
    ├── Sí → Motor + búsqueda pública con fuentes citadas
    │
    └── No
          ↓
      Motor con reglas y análisis local
```

La finalidad es:
- reducir el consumo de servicios externos;
- evitar depender de un solo mecanismo;
- aprovechar la búsqueda pública solo cuando realmente sea necesaria;
- mantener costos lo más cercanos posible a $0.

NO agregar llamadas a servicios externos de IA sin una razón técnica justificada.

---

## 11. AI ORCHESTRATOR

Debe existir una capa de orquestación de IA.

Conceptualmente:

```
FastAPI
   ↓
AI Orchestrator
   ↓
┌───────────────────┐
│                   │
▼                   ▼
Motor IdeaForge     Fake (solo pruebas)
```

El Orchestrator es responsable de:
- seleccionar proveedor;
- seleccionar modelo;
- determinar si se necesita búsqueda;
- manejar errores;
- realizar fallback cuando corresponda;
- registrar llamadas en `ai_api_logs`;
- evitar llamadas innecesarias;
- controlar concurrencia (`AI_MAX_CONCURRENCY`, mediante semáforo);
- centralizar prompts (versionados en `research/prompts.py`);
- mantener una interfaz uniforme.

Componentes en `app/modules/ai/`: `factory.py` (`build_ai_provider`), `orchestrator.py`, `calls.py` (`timed_call` y `build_call_logs`), `errors.py`, `types.py`, `providers/base.py`, `providers/engine.py`, `providers/web_search.py`, `providers/fake.py`, `providers/http.py` y `learning/`.

El resto de la aplicación NO deberá importar directamente el motor ni su código interno. Debe usar `AIOrchestrator`.

---

## 12. FALLBACK

La arquitectura debe permitir situaciones como:

```
Búsqueda en DuckDuckGo
↓
Sin resultados o límite alcanzado
↓
Wikipedia (ES)
↓
Sin resultados
↓
Informar la limitación al usuario
```

Además, `AI_FALLBACK_PROVIDER` puede configurarse para usar otro proveedor cuando el principal falle. Hoy no hay ninguno configurado (valor por defecto: ninguno).

Pero NO se debe hacer fallback automático cuando la tarea requiera información actual de Internet y no exista una fuente disponible.

Ejemplo:

"Resume estos datos"
→ El motor puede hacerlo sin búsqueda.

"Investiga cuáles son los nuevos competidores actuales"
→ Si la búsqueda no devuelve fuentes, no se puede garantizar información actual.

En el segundo caso debe informarse la limitación.

---

## 13. CHATBOT

El chatbot es una funcionalidad de IdeaForge AI y **ya está implementado (fase 13)**.

Su flujo es:

```
React
↓
FastAPI (POST /api/v1/projects/{id}/chat)
↓
AI Orchestrator
↓
Motor IdeaForge
```

Nunca:

```
React
↓
Motor de IA
```

El chatbot usa el contexto del proyecto actual:
- Idea.
- Atributos.
- Competidores.
- Hallazgos.
- Evidencias.
- Riesgos.
- Oportunidades.
- Hipótesis.
- Información faltante.
- Reportes.
- Información geográfica.

Reglas vigentes:
- El contexto se limita en tamaño. Los hallazgos citados se filtran por pertenencia al proyecto.
- El historial que envía el cliente es limitado y no se persiste.
- Prompts y respuestas no se guardan en `ai_api_logs`.
- El chat no ejecuta búsquedas web ni crea datos geográficos.
- Los saludos breves se responden en el backend sin llamar al motor.

---

## 14. REGISTRO DE USO DE IA

La tabla:

```
ai_api_logs
```

es la bitácora de cada llamada a la IA. Cada fila es un intento a un proveedor.

Valores vigentes de `provider`:

```
engine
fake
legacy
```

`legacy` marca registros históricos de proveedores externos retirados. No puede usarse como proveedor activo. Eliminar la dependencia conceptual de `grok` y `gemini`/`ollama` como proveedores activos.

La información registrada permite conocer:
- Usuario y proyecto (ambos pueden quedar vacíos sin borrar el registro).
- Investigación relacionada, si aplica.
- Proveedor.
- Modelo.
- Operación (`AIOperation`).
- Versión del prompt (`prompt_version`).
- Estado de la solicitud (`success` o `error`).
- Código de error si ocurrió.
- Tokens de entrada y salida cuando el proveedor los informa.
- Número de búsquedas realizadas.
- Latencia en milisegundos.
- Costo estimado.

Para el motor propio:

```
estimated_cost_usd = 0
```

o NULL cuando técnicamente corresponda, porque no tiene facturación externa.

No asumir que los tokens estarán disponibles de la misma manera para todos los proveedores. El motor propio puede no reportarlos.

---

## 15. GEOLOCALIZACIÓN Y MAPAS

IdeaForge AI cuenta con funcionalidades de:
- ubicación;
- mapas;
- alcance geográfico;
- geocodificación;
- búsqueda de lugares;
- análisis de competencia física;
- análisis geográfico de una idea de negocio.

Se utiliza el ecosistema de OpenStreetMap (OSM) para minimizar costos y evitar dependencias comerciales innecesarias.

Los componentes principales son:

```
OpenStreetMap
Leaflet
react-leaflet
Nominatim
Overpass API
```

No utilizar Google Maps, Google Places, Mapbox, OpenCage u otros proveedores comerciales salvo que exista una justificación técnica y se apruebe explícitamente.

---

## 16. MAPAS INTERACTIVOS EN EL FRONTEND

Para renderizar mapas en React se utiliza:

```
react-leaflet
```

con Leaflet como motor de mapas.

Se usan los tiles públicos de OpenStreetMap:

```
https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

Todo mapa basado en estos tiles muestra de forma visible la atribución:

```
© OpenStreetMap contributors
```

La atribución NO debe eliminarse, ocultarse ni sustituirse.

Los mapas se integran con la identidad visual de IdeaForge AI:
- bordes suaves;
- sombras;
- glassmorphism cuando corresponda;
- profundidad visual;
- diseño responsive;
- controles accesibles;
- correcta visualización en escritorio, tablet y móvil.

Los efectos visuales no deben perjudicar la legibilidad ni el rendimiento del mapa.

Reglas de uso del mapa:
- La ubicación del dispositivo solo se pide con permiso explícito del usuario.
- La pestaña Competidores incluye búsqueda manual, categorías y radio, y avisa que los lugares mapeados no prueban competencia.

---

## 17. GEOCODIFICACIÓN CON NOMINATIM

Para convertir texto introducido por el usuario en coordenadas geográficas se utiliza Nominatim.

Endpoint:

```
https://nominatim.openstreetmap.org/search
```

Ejemplo:

```
"Ciudad de México"
        ↓
Nominatim
        ↓
Latitud + longitud
        ↓
IdeaForge AI
```

Nominatim se consulta solo cuando el usuario envía una búsqueda explícita, nunca como autocompletado por cada pulsación del teclado.

La aplicación debe respetar estrictamente las políticas y condiciones de uso vigentes de Nominatim.

Debe:
- evitar solicitudes innecesarias;
- implementar debounce en búsquedas interactivas;
- controlar la frecuencia de peticiones (1 petición por segundo como máximo);
- reutilizar resultados mediante caché;
- manejar errores y respuestas de límite;
- evitar saturar el servicio.

Las solicitudes llevan un `User-Agent` identificable configurado en `GEO_USER_AGENT`, por ejemplo:

```
IdeaForgeAI/0.1 (OpenStreetMap geocoding client)
```

No se debe asumir que un límite concreto de peticiones permanecerá invariable. Antes de producción deben verificarse nuevamente las políticas actuales del servicio.

---

## 18. BÚSQUEDA DE COMPETIDORES FÍSICOS CON OVERPASS

Cuando la investigación necesite localizar negocios o lugares físicos, se utiliza Overpass API para consultar datos de OpenStreetMap.

Endpoint de referencia:

```
https://overpass-api.de/api/interpreter
```

Ejemplos:
- restaurantes cercanos;
- cafeterías;
- hoteles;
- tiendas;
- gimnasios;
- servicios;
- establecimientos relacionados;
- negocios similares;
- lugares dentro de un radio;
- concentración de determinadas categorías de negocios.

Reglas de consulta:
- Radio entre 100 y 5000 metros; por defecto 1000.
- Número de resultados acotado y resultados en caché.

Flujo conceptual:

```
Idea de negocio
      ↓
Ubicación
      ↓
Nominatim
      ↓
Coordenadas
      ↓
Overpass API
      ↓
Lugares encontrados
      ↓
Findings
      ↓
Entities
      ↓
Competitors
      ↓
Evidence
      ↓
Motor IdeaForge
      ↓
Análisis
```

Los resultados geográficos deben conservar su procedencia.

NO presentar automáticamente un lugar obtenido mediante OSM como competidor confirmado.

Debe existir una distinción entre:

**Lugar encontrado**

y:

**Competidor identificado**

La clasificación de competidor debe realizarse mediante criterios del sistema y evidencia suficiente.

---

## 19. INTEGRACIÓN DE DATOS GEOGRÁFICOS CON LA INVESTIGACIÓN

La información obtenida mediante Nominatim y Overpass se integra con la arquitectura existente.

No se crea un sistema geográfico aislado.

Los datos se relacionan con:

```
projects
research_queries
findings
entities
competitors
evidence
opportunities
risks
missing_information
validation_hypotheses
```

Ejemplo:

```
Proyecto
↓
Idea
↓
Ubicación objetivo
↓
Nominatim
↓
Coordenadas
↓
Overpass
↓
Lugares encontrados
↓
Findings
↓
Entities
↓
Competitors
↓
Evidence
↓
Análisis
```

La información geográfica también puede utilizarse como evidencia para detectar:
- concentración de competidores;
- zonas con poca oferta;
- proximidad de negocios;
- presencia o ausencia de determinados servicios;
- oportunidades geográficas;
- riesgos relacionados con ubicación.

Estas conclusiones deben identificarse como análisis cuando no constituyan hechos directamente comprobables.

La ausencia de resultados en OSM no se interpreta como ausencia de negocios.

---

## 20. ABSTRACCIÓN DEL PROVEEDOR GEOGRÁFICO

La lógica geográfica debe mantenerse desacoplada del resto de la aplicación.

NO colocar toda la lógica de Nominatim, Overpass o Leaflet:
- directamente dentro de componentes React;
- directamente dentro de `main.py`;
- mezclada con la lógica de negocio;
- duplicada en diferentes módulos.

La arquitectura conceptual es:

```
Geo Provider
│
├── OSM Provider (activo)
│     ├── Nominatim
│     └── Overpass
│
└── Future Provider
      ├── Mapbox
      └── OpenCage
```

Actualmente solo está implementado OSM (`GEO_PROVIDER=openstreetmap`, único valor válido).

La arquitectura debe permitir cambiar de proveedor sin reescribir todo el sistema.

---

## 21. CONFIGURACIÓN GEOGRÁFICA MEDIANTE VARIABLES DE ENTORNO

La configuración se controla mediante variables de entorno.

Configuración implementada:

```
GEO_PROVIDER=openstreetmap
GEO_NOMINATIM_URL=https://nominatim.openstreetmap.org
GEO_OVERPASS_URL=https://overpass-api.de/api/interpreter
GEO_USER_AGENT=IdeaForgeAI/0.1 (OpenStreetMap geocoding client)
```

En una futura etapa de producción podría existir (PROPUESTA, no implementada):

```
MAP_PROVIDER=mapbox
GEOCODING_PROVIDER=opencage
```

Si posteriormente se utiliza un proveedor comercial:
- la API Key permanece exclusivamente en backend;
- nunca se expone en React;
- se almacena mediante variables de entorno;
- `.env.example` no contiene secretos.

---

## 22. COSTOS Y LÍMITES DE SERVICIOS GEOGRÁFICOS

IdeaForge AI prioriza durante desarrollo:
- herramientas open source;
- servicios gratuitos;
- APIs públicas;
- procesamiento local cuando sea posible.

Sin embargo:

**gratuito NO significa ilimitado.**

Cada servicio debe utilizarse respetando:
- términos de uso;
- políticas;
- límites;
- atribuciones;
- frecuencia de solicitudes;
- restricciones técnicas.

NO implementar mecanismos destinados a evadir límites de proveedores.

Si en producción el volumen de solicitudes supera razonablemente las capacidades de los servicios públicos, debe evaluarse una solución adecuada antes de escalar.

---

## 23. CACHE Y REUTILIZACIÓN DE DATOS GEOGRÁFICOS

Siempre que sea apropiado, los resultados geográficos se reutilizan para evitar consultas innecesarias.

Ejemplo:

```
Usuario busca:
"Cafeterías en Toluca"

↓
Se almacenan findings

Usuario vuelve a consultar:
"¿Cuáles son mis competidores?"

↓
Utilizar datos existentes cuando sigan siendo suficientemente recientes
```

La aplicación considera:
- fecha de consulta;
- fuente;
- ubicación;
- contexto;
- antigüedad;
- necesidad de actualización.

No se debe volver a consultar automáticamente un servicio externo si los datos existentes son suficientes para responder la solicitud.

La caché de geocodificación y de lugares es en memoria del proceso del backend.

La PWA NUNCA cachea `/api`, coordenadas, búsquedas ni datos privados.

---

## 24. ARQUITECTURA GENERAL

La aplicación sigue esta arquitectura:

```
┌─────────────────────────────────────┐
│              FRONTEND               │
│ React + TypeScript                  │
│ Vite + TailwindCSS                  │
│ PWA                                 │
│ Supabase JS (solo autenticación)    │
│                                     │
│ react-leaflet / Leaflet             │
└──────────────────┬──────────────────┘
                   │
                   │ HTTP / REST (JSON, Bearer)
                   ▼
┌─────────────────────────────────────┐
│               BACKEND               │
│ Python + FastAPI                    │
│                                     │
│ Auth (Supabase, verificación JWT)   │
│ Projects                            │
│ Research                            │
│ Sources                             │
│ Findings                            │
│ Entities                            │
│ Competitors                         │
│ Evidence                            │
│ Analysis                            │
│ Chat                                │
│ Geography / Geo Services            │
│ Reports                             │
│ Admin (con Laboratorio)             │
│ AI Orchestrator                     │
│ Motor IdeaForge                     │
└──────────────┬───────────┬──────────┘
               │           │
               │           │
               ▼           ▼
       ┌─────────────┐   ┌──────────────────────┐
       │ PostgreSQL  │   │ Servicios externos   │
       │ 18 (local)  │   │                      │
       │             │   │ Supabase Auth        │
       │             │   │ DuckDuckGo           │
       │             │   │ Wikipedia (ES)       │
       │             │   │ Nominatim            │
       │             │   │ Overpass             │
       └─────────────┘   └──────────────────────┘
```

Despliegue previsto (fase 17, en pausa): el frontend se publica en un hosting estático; FastAPI y PostgreSQL permanecen en la computadora del usuario y se exponen mediante un túnel HTTPS. Detalle en la sección 31 y el Anexo H.

---

## 25. STACK TECNOLÓGICO OBLIGATORIO

### Frontend

Utiliza:
- React 19
- TypeScript 7 (modo estricto)
- Vite 8
- TailwindCSS v4 (`@tailwindcss/vite`)
- React Router 7
- TanStack Query 5
- React Icons
- Leaflet y react-leaflet
- Three.js `three@0.186.0` (escena del fondo, carga diferida)
- Supabase JS (solo para autenticación)
- Vitest y Testing Library para pruebas

El frontend funciona como PWA.

Debe ser responsive.

Debe funcionar correctamente en:
- Desktop.
- Laptop.
- Tablet.
- Smartphone.

### Backend

Utiliza:
- Python 3.13 gestionado con `uv`
- FastAPI
- Pydantic v2
- SQLAlchemy 2 asíncrono con asyncpg
- Alembic
- PyJWT y cryptography (verificación de tokens de Supabase)
- pytest y Ruff

El backend utiliza una arquitectura modular.

NO crear una aplicación donde toda la lógica esté dentro de `main.py`.

### Base de datos

Utiliza:
- PostgreSQL 18

La base de datos se diseña de forma relacional y normalizada.

Utiliza:
- UUID (PK generada con `uuidv7()`).
- TIMESTAMPTZ.
- CITEXT para correos.
- JSONB solo cuando realmente sea necesario.
- Claves foráneas.
- Restricciones UNIQUE.
- Índices.
- NOT NULL.
- CHECK para enumeraciones (VARCHAR + CHECK, nunca ENUM nativo).
- Extensión `pg_trgm` para búsqueda por similitud.

---

## 26. BASE DE DATOS DE REFERENCIA

La estructura de base de datos ya está implementada y migrada (cabeza de Alembic: `d8a24b6e91c0`). El detalle completo de columnas, restricciones y relaciones está en el Anexo B.

Las 25 tablas de dominio son:

- users
- refresh_tokens
- projects
- idea_attributes
- research_runs
- research_queries
- sources
- research_query_sources
- evidence
- findings
- finding_evidence
- finding_entities
- entities
- entity_aliases
- competitors
- opportunities
- opportunity_findings
- risks
- risk_findings
- validation_hypotheses
- hypothesis_findings
- missing_information
- reports
- report_sections
- ai_api_logs

Además existe la tabla técnica `alembic_version`. Son 33 llaves foráneas y 11 triggers `trg_*_updated_at`.

Esta estructura es el punto de partida y no debe cambiar salvo por una razón técnica explicada.

Puede:
- Mejorarse.
- Normalizarse.
- Agregar relaciones necesarias.
- Agregar índices.
- Agregar restricciones.
- Crear tablas auxiliares cuando realmente sean necesarias.
- Cambiar tipos de datos cuando exista una razón técnica.

Pero cada cambio importante debe explicarse antes de implementarse y requiere una migración de Alembic.

No elimines información importante sin justificarlo.

---

## 27. CAMBIO EN `ai_api_logs` — COMPLETADO

La definición conceptual original contemplaba:

```
provider:
grok | gemini
```

Ese cambio se completó en dos migraciones:

- `95f14ef1a15d`: agrega `ollama` y el costo estimado nullable (etapa posteriormente retirada).
- `d8a24b6e91c0`: convierte `gemini` y `ollama` a `legacy` y acepta `engine`, `fake` y `legacy`.

Valores vigentes:

```
provider:
engine | fake | legacy
```

Los registros históricos se conservan con la etiqueta `legacy`, sin atribuirlos a otro proveedor. Cualquier cambio futuro se hace con una migración segura, sin destruir información existente.

---

## 28. SEGURIDAD

Desde el principio debes considerar:
- Variables de entorno.
- Protección de claves.
- Hash seguro de contraseñas.
- Validación de datos.
- CORS correctamente configurado (solo los orígenes de `CORS_ORIGINS`, sin `*`).
- Protección contra SQL Injection mediante ORM.
- Control de acceso.
- Autenticación.
- Autorización (propiedad verificada en cada operación).
- Manejo seguro de errores.
- No exponer información sensible.
- No almacenar contraseñas en texto plano.
- Validación de entradas para consultas geográficas.
- Control de frecuencia de solicitudes externas.
- Protección contra abuso de endpoints de investigación.
- Cabeceras de seguridad y `Cache-Control: no-store` en las respuestas de la API.

Nunca coloques:
- Contraseñas.
- Claves de API.
- Tokens secretos.
- Credenciales de PostgreSQL.

directamente dentro del código.

Las variables relacionadas con IA y geografía usan `.env`.

Ejemplo:

```
AI_PROVIDER=engine
AI_ENGINE_MODEL=ideaforge-engine-v1

GEO_PROVIDER=openstreetmap
GEO_NOMINATIM_URL=https://nominatim.openstreetmap.org
GEO_OVERPASS_URL=https://overpass-api.de/api/interpreter
```

No deben existir `GEMINI_API_KEY`, `OLLAMA_BASE_URL` ni `OLLAMA_MODEL`.

El `.env` debe estar incluido en `.gitignore`.

Debe existir un `.env.example` sin secretos.

---

## 29. DISEÑO VISUAL DEL FRONTEND

Quiero que IdeaForge AI tenga una interfaz moderna y tecnológica.

La inspiración visual combina:

### Neomorfismo

- Sombras suaves.
- Elementos ligeramente extruidos.
- Sensación de profundidad.
- Botones con apariencia física.

### Glassmorfismo

- Paneles translúcidos.
- `backdrop-blur`.
- Bordes sutiles.
- Transparencias.
- Capas visuales.

### Animaciones

Utiliza:
- Transiciones suaves.
- Hover effects.
- Microinteracciones.
- Animaciones de entrada.
- Transformaciones ligeras.
- Efectos de profundidad.
- Jelly effect en botones y tarjetas interactivas.

No abuses de las animaciones. Las animaciones respetan `prefers-reduced-motion`.

El resultado debe parecer un producto tecnológico real y profesional.

La identidad visual debe representar:

**Tecnología + Inteligencia Artificial + Investigación + Negocios + Análisis de datos.**

Dirección visual vigente:
- Dashboard de investigación data-dense con azul marino y ámbar.
- Fuentes Fira Sans (texto) y Fira Code (datos).
- Modo claro `#f8fafc` y modo oscuro `#0b1220`. El modo oscuro se activa con `document.documentElement.dataset.theme = "dark"` y se guarda en `localStorage("ideaforge-theme")`.
- Navegación lateral en escritorio y barra inferior en móvil.
- "Cristal líquido" selectivo en el chrome y los controles; paneles de datos sólidos para priorizar la legibilidad.

Utilidades visuales propias (todas respetan movimiento reducido): `glass`, `stage-3d`, `neo-raised`, `neo-inset`, `tilt-3d`, `fog-uncertain`, `filament-line`, `jelly`, `text-gradient`, `animate-fade-up`.

Restricciones técnicas del fondo Three.js (`ForgeCanvas.tsx`, cargado de forma diferida desde `Backdrop.tsx`):
- No rediseñar ni eliminar su escena sin indicación.
- Evitar `backdrop-filter` anidado y trabajo por cuadro en `pointermove`.
- No aplicar `opacity < 1` en `ForgeCanvas`, `-z-10` en `Backdrop` ni `transform-style: preserve-3d` en contenedores padre: rompen `backdrop-filter` en Chromium y Edge.

Los mapas se adaptan a esta identidad sin perder legibilidad.

---

## 30. REGLAS DE DESARROLLO

Quiero que el proyecto se desarrolle de forma incremental.

NO generes todo el proyecto de una sola vez sin verificar.

El desarrollo se organiza por fases (sección 31). Para cada fase:

1. Explicar brevemente qué se hará.
2. Indicar qué archivos se crearán o modificarán.
3. Implementar solamente lo correspondiente a esa fase.
4. Explicar cómo ejecutar y probar lo realizado.
5. Indicar cualquier dependencia nueva.
6. Indicar posibles problemas o decisiones técnicas.
7. Verificarlo con las pruebas y comandos del Anexo F.

**Para la reconstrucción desde cero:** la IA puede avanzar por todas las fases en una misma sesión, siempre que cada una quede verificada antes de la siguiente. Si el usuario indica una pausa, se respeta la pausa.

No inventes funcionalidades.

Prioriza:
- Código limpio.
- Código mantenible.
- Modularidad.
- Seguridad.
- Escalabilidad razonable.
- Buenas prácticas.
- UX.
- Accesibilidad.
- Rendimiento.

Convenciones obligatorias:
- Textos de la interfaz en español.
- Errores de la API siempre con formato `{"error": {"code", "message", "details?"}}`.
- No añadir ni quitar comentarios sin que se pida.
- Dependencias nuevas: en el backend con `uv add`; en el frontend con `npm install --before=<fecha de hace 7 días> --save-exact <paquete>`. Ningún paquete publicado hace menos de 7 días.

---

## 31. FASES DEL PROYECTO

Estas son las fases en orden de construcción. Entre paréntesis está el estado final.

### FASE 1 — Análisis del proyecto y arquitectura (completada)

Análisis del proyecto y de la arquitectura.

### FASE 2 — Diseño definitivo de PostgreSQL (completada)

Diseño de las tablas, restricciones e índices (Anexo B).

### FASE 3 — Configuración del backend (completada)

Configuración del backend con Python y FastAPI.

### FASE 4 — Modelos, migraciones y PostgreSQL (completada)

Modelos SQLAlchemy por módulo, migraciones de Alembic y conexión a PostgreSQL.

### FASE 5 — Autenticación y usuarios (completada)

Autenticación con Supabase Auth. El rol de administrador se conserva en la base local (`users.role`). Vinculación de cuentas por `supabase_user_id`.

### FASE 6 — Gestión de proyectos e ideas (completada)

Crear, listar, editar, borrar proyectos y gestionar atributos de la idea.

### FASE 7 — Frontend base (completada)

React, TypeScript, Vite, TailwindCSS, rutas, sistema de diseño y cliente de API.

### FASE 8 — Dashboard y flujo principal (completada)

Panel inicial, onboarding, estructura de la idea y confirmación de estructura.

### FASE 9 — Investigación y fuentes (completada)

Orquestador de investigación, búsqueda pública con fuentes citadas, preguntas y fuentes.

### FASE 10 — Hallazgos, entidades, competidores y evidencia (completada)

Extracción de hallazgos con evidencia, entidades y competidores, con revisión humana (aceptar o rechazar).

### FASE 11 — Oportunidades, riesgos, hipótesis e información faltante (completada)

Análisis con cuatro tipos de elementos, cada uno vinculado a hallazgos (sección 33).

### FASE 12 — Orquestación de IA (completada con cambio de arquitectura)

Capa `AIOrchestrator` con una interfaz común de proveedores. Se integraron Gemini y Ollama; después se retiraron y el motor propio de IdeaForge quedó como proveedor activo (sección 41).

### FASE 13 — Chatbot contextual (completada)

Chat del proyecto con contexto limitado y referencias verificables.

### FASE 14 — Generación de informes (completada)

Informes versionados, veredicto estructurado, descarga Markdown e impresión a PDF.

### FASE 15 — PWA, mapas, geolocalización, optimización y experiencia móvil (completada)

PWA instalable, mapas OpenStreetMap, geocodificación, lugares cercanos y experiencia móvil.

### FASE 16 — Seguridad, pruebas y corrección de errores (completada)

Cabeceras de seguridad, limitador de login, pruebas de autorización y suite completa de pruebas.

### FASE 17 — Preparación para producción (EN PAUSA por indicación del usuario)

Pendiente: compartir el limitador de login entre procesos o réplicas, y el despliegue del frontend (sección 32).

**IMPORTANTE:**

Las funcionalidades geográficas se implementan en la fase 15 y se integran con el modelo existente. NO crear una base de datos geográfica paralela.

Después de la fase 16 se agregaron, sin fase formal:
- El motor propio de IdeaForge como único proveedor de IA activo (commit `4e7a08f`).
- El laboratorio de administración (commit `8b8f43b`, ver Anexo G).
- El árbol de decisión para aprender de las revisiones humanas (Anexo G).
- El filtro de cifras atípicas en la estimación de inversión.
- El rediseño del frontend (commit `ffc5b95`).
- La documentación de prácticas (`HECTOR.md`), la guía de arranque (`prender proyecto.md`) y el script `ideaforge_setup.sql` (commit `0b4e6f3`).

---

## 32. ESTADO ACTUAL DEL PROYECTO

**MUY IMPORTANTE**

**EL PROYECTO SE ENCUENTRA EN LA FASE 17, EN PAUSA.** Las fases 1 a 16 están completadas, más el trabajo posterior listado en la sección 31.

Cuando se reconstruya desde cero, el resultado debe quedar exactamente en este estado. Verificado el 2026-11-13:

- Migración: `d8a24b6e91c0` (cabeza).
- Pruebas de backend: 220 pasan.
- Pruebas de frontend: 62 pasan (17 archivos).
- `npm run typecheck`, `ruff check`, `ruff format --check` y `npm run build`: sin errores.

Reglas de trabajo sobre el estado actual:

- NO reiniciar el proyecto.
- NO volver a desarrollar las fases 1 a 16.
- NO eliminar funcionalidades existentes.
- NO reconstruir la arquitectura desde cero una vez construida.

Antes de modificar cualquier cosa, inspecciona el código existente y comprende qué está implementado actualmente.

**Pendiente de la fase 17 (cuando se reanude):**
- Compartir el limitador de login entre procesos o réplicas (hoy vive en memoria de un solo proceso).
- Desplegar solo el frontend en Vercel (raíz `frontend`, preset Vite). `frontend/vercel.json` redirige rutas SPA al shell.
- En Vercel, `VITE_API_URL` apunta a la URL HTTPS del túnel más `/api/v1`, además de las variables públicas de Supabase.
- FastAPI y PostgreSQL permanecen en la computadora del usuario. Para usarlo desde otros dispositivos, la computadora, el backend y el túnel deben permanecer encendidos.
- No abrir puertos del router; limitar CORS al dominio publicado.
- Elegir el proveedor de hosting del frontend y el del túnel antes de configurar el despliegue.

---

## 33. FASE 11 — ALCANCE IMPLEMENTADO

La Fase 11 está completada. Esta sección describe lo que se implementó para que la reconstrucción respete el mismo alcance.

### Oportunidades

Registrar oportunidades identificadas para una idea de negocio.

Cada oportunidad se relaciona con los hallazgos que la respaldan (tabla `opportunity_findings`).

### Riesgos

Registrar riesgos identificados, con categoría (`market`, `competition`, `technical`, `regulatory`, `financial`, `operational`, `other`), probabilidad (`likelihood`), impacto (`impact`) y mitigación opcional.

Los riesgos diferencian entre:
- riesgo basado en evidencia;
- riesgo inferido por el motor;
- riesgo pendiente de comprobar.

### Hipótesis de validación

Registrar afirmaciones que todavía necesitan validación, con método de validación, criterio de éxito y prioridad.

Estados implementados (`validation_status`): `pending`, `in_progress`, `validated`, `invalidated` e `inconclusive`.

### Información faltante

Registrar información que todavía no está disponible o que es necesaria para aumentar la confianza del análisis.

Estados implementados (`resolution_status`): `open`, `resolved` y `dismissed`.

### Revisión

Cada elemento tiene `origin` (`ai` o `user`) y `review_status` (`proposed`, `accepted` o `rejected`). En el frontend, `features/analysis/AnalysisTab.tsx` muestra los cuatro cuadrantes con CRUD, aceptación o rechazo y trazabilidad hacia hallazgos y fuentes.

---

## 34. PRINCIPIO DE EVIDENCIA EN FASE 11

No permitas que oportunidades y riesgos sean simplemente texto generado sin contexto.

Cuando sea posible deben relacionarse con:
- findings;
- evidence;
- sources;
- competitors.

Por ejemplo:

```
Oportunidad
↓
Evidencia
↓
Fuente
↓
URL
```

o:

```
Riesgo
↓
Hallazgo
↓
Evidencia
↓
Fuente
```

Si una oportunidad o riesgo es únicamente una inferencia del motor, debe marcarse como:

```
origin = ai
review_status = proposed
```

hasta que una persona lo revise. Nunca debe presentarse como hecho comprobado.

---

## 35. INFORMACIÓN FALTANTE

El sistema debe poder identificar:
- qué información falta;
- por qué es importante;
- qué impacto tiene en el análisis;
- cómo podría obtenerse posteriormente.

Ejemplo:

**Información faltante:**
"Precio promedio de los competidores locales."

**Importancia:**
"Es necesaria para evaluar la viabilidad del modelo de ingresos."

**Método sugerido:**
"Investigar sitios web, marketplaces y fuentes locales."

La información geográfica también puede convertirse en información faltante.

Ejemplo:

**Información faltante:**
"No se dispone de suficientes datos sobre competidores
dentro del área geográfica objetivo."

**Método sugerido:**
"Realizar una consulta geográfica mediante Overpass."

---

## 36. CUOTAS Y COSTOS

IdeaForge debe diseñarse pensando en minimizar costos.

Prioridades:
- Usar el motor propio (procesamiento local en Python) como vía principal.
- Usar búsqueda pública solo cuando haga falta información actual.
- Evitar llamadas redundantes.
- Almacenar resultados de investigaciones para evitar repetirlas innecesariamente.
- Reutilizar findings y evidence existentes.
- Controlar las consultas de búsqueda.
- Registrar consumo en `ai_api_logs`.
- Utilizar OpenStreetMap y herramientas asociadas cuando sean adecuadas.

No crear una arquitectura que repita búsquedas para obtener información que ya existe en PostgreSQL.

---

## 37. CACHE Y REUTILIZACIÓN DE INVESTIGACIÓN

Siempre que sea posible, el sistema reutiliza información existente.

Ejemplo:

```
Usuario investiga:
"Cafeterías en Toluca"

↓
Se almacenan findings

Usuario vuelve a preguntar:
"¿Cuáles son mis competidores?"

↓
No volver a investigar automáticamente
↓
Utilizar findings existentes
```

La aplicación considera:
- fecha del hallazgo;
- antigüedad;
- fuente;
- contexto;
- necesidad de actualización.

Si los datos están demasiado antiguos, puede proponerse una nueva investigación.

---

## 38. NO ALUCINAR

El motor no debe inventar:
- empresas;
- precios;
- estadísticas;
- competidores;
- URLs;
- fuentes;
- datos de mercado;
- ubicaciones;
- coordenadas;
- establecimientos;
- cifras geográficas.

Reglas que lo garantizan en el código:
- Todo hallazgo sin evidencia `supports` se descarta.
- Las entidades solo se crean si su nombre aparece en las respuestas.
- Las URLs solo provienen de páginas realmente obtenidas.
- Las citas tienen posición exacta (`span`) validada.

Cuando no exista evidencia suficiente:

```
No se encontró evidencia suficiente.
```

o:

```
Información no verificada.
```

La incertidumbre es un resultado válido.

---

## 39. CAMBIOS FUTUROS DE PROVEEDOR

El único proveedor de IA activo es el motor propio de IdeaForge (`engine`). El proveedor `fake` existe solo para pruebas.

La arquitectura debe permitir agregar otro proveedor posteriormente sin modificar todo el backend.

Por ejemplo:

```
AI Provider
│
├── Engine (activo)
├── Fake (solo pruebas)
└── FutureProvider
```

Para geolocalización:

```
Geo Provider
│
├── OSM (activo)
└── FutureProvider
```

Pero:

**NO IMPLEMENTAR FutureProvider.**

Solamente diseñar correctamente la abstracción.

---

## 40. REGLA MUY IMPORTANTE

NO avances automáticamente por fases fuera de lo que se pida.

Cuando se indique una fase concreta:

```
FASE N
```

trabaja únicamente en la fase N y verifícala.

Si una fase necesita modificar algo definido anteriormente, explica primero:
- Qué cambiará.
- Por qué es necesario.
- Qué impacto tendrá.
- Qué archivos serán afectados.
- Si requiere migración de base de datos.

Después espera la aprobación cuando corresponda.

**Excepción:** en la reconstrucción desde cero (sección 0), la IA construye todas las fases hasta el estado de la sección 32, verificando cada una.

---

## 41. IMPORTANTE SOBRE LA FASE 12

La Fase 12 se completó con un cambio de arquitectura. La integración vigente es:

```
Motor IdeaForge (engine)
+
AI Orchestrator
```

**RETIRADOS:** Gemini API y Ollama. **NO utilizar Grok.** Ninguno debe existir en el código, en las dependencias ni en la configuración.

La Fase 12 contempla:
- Interfaz común de proveedores (`AIProvider`).
- Motor propio de IdeaForge (`engine`).
- Proveedor de pruebas (`fake`), prohibido en producción.
- Configuración mediante `.env`.
- Selección de proveedor (`AI_PROVIDER`).
- Selección de modelo (`AI_ENGINE_MODEL`).
- Manejo de errores y de límites.
- Registro en `ai_api_logs`.
- Fallback de búsqueda (DuckDuckGo, luego Wikipedia).
- Protección de secretos.
- Pruebas.

Migración asociada: `d8a24b6e91c0` convierte los registros de `gemini` y `ollama` a `legacy`.

---

## 42. IMPORTANTE SOBRE LA IMPLEMENTACIÓN GEOGRÁFICA

La implementación geográfica está completada (fase 15).

### Frontend

Se utiliza:
- Leaflet
- react-leaflet

### Datos geográficos

Se utiliza:
- OpenStreetMap

### Geocodificación

Se utiliza:
- Nominatim

### Lugares y negocios

Se utiliza:
- Overpass API

### Configuración

Se utiliza:

```
GEO_PROVIDER=openstreetmap
```

No agregar proveedores comerciales sin una necesidad técnica real.

La implementación respeta las políticas y límites vigentes de cada servicio.

Los resultados se integran con el sistema de:

```
Sources
Research Queries
Findings
Entities
Competitors
Evidence
```

Las referencias OSM del informe quedan como fuentes y se citan con referencias `G#`.

---

## 43. FLUJO COMPLETO DE IDEAFORGE

La visión general del sistema es:

```
                    IDEA DEL USUARIO
                           │
                           ▼
                  ESTRUCTURACIÓN DE IDEA
                           │
                           ▼
                     INVESTIGACIÓN
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
      WEB/FUENTES      GEOGRAFÍA       OTRAS FUENTES
          │                │                │
          │           Nominatim             │
          │           Overpass              │
          │                │                │
          └────────────────┼────────────────┘
                           ▼
                       HALLAZGOS
                           │
                           ▼
                        EVIDENCIA
                           │
                           ▼
                      COMPETIDORES
                           │
                           ▼
                    ANÁLISIS
                           │
                           ▼
                  MOTOR IDEAFORGE (PYTHON)
                           │
                           ▼
                    OPORTUNIDADES
                           │
                    RIESGOS
                           │
               HIPÓTESIS DE VALIDACIÓN
                           │
                  INFORMACIÓN FALTANTE
                           │
                           ▼
                       REPORTES
                           │
                           ▼
                  VEREDICTO Y CHAT
```

El sistema mantiene siempre la trazabilidad:

```
Resultado
↓
Análisis
↓
Evidencia
↓
Hallazgo
↓
Fuente
```

Cuando existe información geográfica:

```
Resultado
↓
Análisis geográfico
↓
Lugar / coordenadas
↓
Overpass / Nominatim
↓
OpenStreetMap
```

---

## 44. REGLA FINAL

Antes de escribir código:

1. Inspecciona el proyecto actual (o, en una reconstrucción, lee este documento completo y los anexos).
2. Identifica qué está implementado y qué falta para la fase solicitada.
3. No destruyas funcionalidades existentes.
4. No reinventes estructuras que ya funcionan.
5. Reutiliza componentes existentes cuando sea apropiado.
6. Explica cambios importantes.
7. Implementa solamente lo solicitado.
8. Prueba lo implementado con los comandos del Anexo F.
9. Indica cómo verificarlo.

---

## ESTADO ACTUAL

IdeaForge AI está en **FASE 17, EN PAUSA**. Las fases 1 a 16 están completadas, y después de la fase 16 se agregaron el motor propio de IA, el laboratorio de administración y el árbol de decisión.

Por lo tanto, si recibes este prompt, debes entender que:

- Si el proyecto ya existe, NO debes comenzar desde la Fase 1: trabaja sobre el código existente.
- Si el proyecto no existe, construye las fases en orden hasta llegar al estado de la sección 32 y verifícalo con el Anexo F.
- La IA de la aplicación es el **motor propio de IdeaForge en Python** (`AI_PROVIDER=engine`).
- **Gemini, Ollama y Grok están retirados del proyecto.**
- La arquitectura geográfica es: **OpenStreetMap + Nominatim + Overpass + Leaflet/react-leaflet**, desacoplada para permitir futuras sustituciones de proveedor.
- La base de datos está en la migración `d8a24b6e91c0` con 25 tablas de dominio.
- El backend tiene 220 pruebas en verde y el frontend 62.

---

# ANEXOS

Los anexos contienen la referencia técnica exacta del estado actual. Son parte del prompt y deben respetarse.

---

## ANEXO A — CONFIGURACIÓN Y VARIABLES DE ENTORNO

### A.1 Backend (`backend/.env`)

Plantilla de `backend/.env.example`. Copiar a `backend/.env` y ajustar valores. NUNCA subir `.env` al repositorio.

```env
APP_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:5173

DATABASE_URL=postgresql+asyncpg://ideaforge:CAMBIAR@localhost:5432/ideaforge_dev
TEST_DATABASE_URL=postgresql+asyncpg://ideaforge:CAMBIAR@localhost:5432/ideaforge_test

LEGACY_AUTH_ENABLED=false
SECRET_KEY=
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=PEGA_AQUI_TU_PUBLISHABLE_KEY
SUPABASE_JWT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWKS_URL=

LOGIN_MAX_FAILED_ATTEMPTS=5
LOGIN_LOCKOUT_SECONDS=900

AI_PROVIDER=engine
AI_ENGINE_MODEL=ideaforge-engine-v1
AI_TIMEOUT_SECONDS=240
AI_MAX_CONCURRENCY=3
AI_FAKE_LATENCY_MS=700

GEO_PROVIDER=openstreetmap
GEO_NOMINATIM_URL=https://nominatim.openstreetmap.org
GEO_OVERPASS_URL=https://overpass-api.de/api/interpreter
GEO_USER_AGENT=IdeaForgeAI/0.1 (OpenStreetMap geocoding client)

RESEARCH_MAX_QUESTIONS=8
RESEARCH_MAX_RUNS_PER_DAY=10
```

Valores por defecto en el código (`app/core/config.py`):

| Variable | Por defecto | Rango o nota |
|---|---|---|
| `APP_ENV` | `development` | `development`, `test`, `production` |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `CORS_ORIGINS` | `http://localhost:5173` | lista separada por comas, sin `*` |
| `LEGACY_AUTH_ENABLED` | `false` | solo para pruebas o migración controlada |
| `LOGIN_MAX_FAILED_ATTEMPTS` | 5 | mínimo 1 |
| `LOGIN_LOCKOUT_SECONDS` | 900 | mínimo 60 |
| `AI_PROVIDER` | `fake` (código) / `engine` (`.env.example`) | `fake` prohibido en `production` |
| `AI_FALLBACK_PROVIDER` | ninguno | opcional |
| `AI_ENGINE_MODEL` | `ideaforge-engine-v1` | 1 a 100 caracteres |
| `AI_TIMEOUT_SECONDS` | 360 | entre 5 y 600 |
| `AI_MAX_CONCURRENCY` | 3 | entre 1 y 10 |
| `AI_FAKE_LATENCY_MS` | 700 | entre 0 y 10 000 |
| `GEO_PROVIDER` | `openstreetmap` | único valor válido |
| `RESEARCH_MAX_QUESTIONS` | 8 | entre 3 y 15 |
| `RESEARCH_MAX_RUNS_PER_DAY` | 10 | mínimo 1 |
| `RESEARCH_RECOVER_ON_STARTUP` | `true` | en tests se desactiva |

La clave `SECRET_KEY` y los tokens heredados solo son necesarios si `LEGACY_AUTH_ENABLED=true`.

Ya no existen: `GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `MAP_PROVIDER`, `GEOCODING_PROVIDER`, `PLACES_PROVIDER`.

### A.2 Frontend (`frontend/.env`)

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clave publicable de Supabase (puede estar en el frontend) |
| `VITE_API_URL` | solo en producción: URL HTTPS del túnel más `/api/v1` |

En desarrollo, el frontend usa el proxy de Vite: `/api` se envía a `http://localhost:8000`.

---

## ANEXO B — BASE DE DATOS

### B.1 Convenciones

- PostgreSQL 18, usuario de aplicación `ideaforge` (sin superusuario y sin `CREATEDB`).
- Base de desarrollo `ideaforge_dev`; base de pruebas `ideaforge_test` (su nombre debe terminar en `_test`; se vacía en cada ejecución de pruebas).
- PK en todas las tablas de entidades: `id UUID` generado con `uuidv7()`.
- Mixins: `TimestampMixin` (`created_at`, `updated_at` con trigger `set_updated_at()`), `CreatedAtMixin` (solo `created_at`), `ReviewableMixin` (`origin`, `review_status`).
- Enumeraciones: `VARCHAR` con restricción `CHECK`, creadas con `str_enum()`. Nunca ENUM nativo.
- Sin `relationship()` de SQLAlchemy.
- Las llaves foráneas compuestas garantizan que una evidencia, pregunta o vínculo pertenezca al mismo proyecto que el registro al que apunta.

### B.2 Enumeraciones

| Enumeración | Valores |
|---|---|
| `user.role` | `user`, `admin` |
| `project.status` | `draft`, `structured`, `researching`, `analyzed` |
| `idea_attributes.attribute_type` | `problem`, `solution`, `customer_segment`, `product_service`, `channels`, `revenue_model`, `geographic_scope`, `differentiators`, `technologies` |
| `origin` | `ai`, `user` |
| `review_status` | `proposed`, `accepted`, `rejected` |
| `level` (confianza, potencial, amenaza, probabilidad, impacto) | `low`, `medium`, `high`, `undetermined` |
| `priority` | `low`, `medium`, `high` |
| `research_runs.status` | `pending`, `running`, `completed`, `failed`, `interrupted` |
| `research_runs.current_step` | `planning`, `searching`, `extracting`, `analyzing`, `scoring` |
| `research_queries.category` y `findings.finding_type` | `market`, `customers`, `competition`, `substitutes`, `technology`, `regulation`, `pricing`, `other` |
| `research_queries.status` | `pending`, `completed`, `failed` |
| `sources.source_type` | `news`, `company_site`, `government`, `academic`, `marketplace`, `social`, `blog`, `review_site`, `other`, `unknown` |
| `evidence.evidence_kind` | `cited_claim`, `source_excerpt` |
| `finding_evidence.stance` | `supports`, `contradicts`, `context` |
| `entities.entity_type` | `company`, `product`, `technology`, `organization`, `other` |
| `competitors.competitor_type` | `direct`, `indirect`, `substitute`, `alternative` |
| `risks.category` | `market`, `competition`, `technical`, `regulatory`, `financial`, `operational`, `other` |
| `validation_hypotheses.validation_status` | `pending`, `in_progress`, `validated`, `invalidated`, `inconclusive` |
| `missing_information.resolution_status` | `open`, `resolved`, `dismissed` |
| `reports.status` | `generating`, `completed`, `failed` |
| `report_sections.section_type` | `executive_summary`, `idea_overview`, `market`, `competition`, `opportunities`, `risks`, `hypotheses`, `missing_information`, `sources`, `conclusions` |
| `ai_api_logs.provider` y `reports.ai_provider`, `research_runs.ai_provider` | `engine`, `fake`, `legacy` |
| `ai_api_logs.operation` | `idea_structuring`, `research_planning`, `grounded_search`, `extraction`, `analysis`, `report_generation`, `chat` |
| `ai_api_logs.status` | `success`, `error` |

### B.3 Tablas

**users** — cuentas de personas.
- `id` UUID PK.
- `email` CITEXT, único, máximo 254 caracteres.
- `supabase_user_id` UUID, único, opcional.
- `password_hash` texto (huella de la autenticación heredada).
- `full_name` VARCHAR(120), no vacío.
- `role` (`user` / `admin`), por defecto `user`.
- `is_active` booleano, por defecto verdadero.
- `last_login_at` TIMESTAMPTZ, opcional.
- `created_at`, `updated_at`.

**refresh_tokens** — tokens de renovación (autenticación heredada).
- `user_id` FK a users, CASCADE; índice.
- `token_hash` CHAR(64), único (SHA-256; nunca el token en claro).
- `expires_at` mayor que `created_at`.
- `revoked_at` opcional. `replaced_by_id` FK a sí misma, SET NULL.

**projects** — la idea del usuario.
- `user_id` FK a users, CASCADE.
- `title` VARCHAR(200), no vacío (`btrim(title) <> ''`).
- `raw_idea` texto entre 20 y 5000 caracteres.
- `status` (`draft` por defecto).
- Índice `(user_id, updated_at DESC)`.

**idea_attributes** — partes de la idea.
- `project_id` FK, CASCADE.
- `attribute_type` (ver B.2).
- `value` texto entre 1 y 4000 caracteres.
- `position` SMALLINT ≥ 0, por defecto 0.
- `origin` (`ai` / `user`).
- `is_confirmed` booleano, por defecto falso.
- Único `(project_id, attribute_type, position)`.

**research_runs** — una investigación completa.
- `project_id` FK, CASCADE. Único `(id, project_id)`.
- `status` (por defecto `pending`); `current_step` opcional.
- `progress_pct` SMALLINT entre 0 y 100, por defecto 0.
- `ai_provider`, `ai_model` VARCHAR(100).
- `error_code` VARCHAR(50), `error_message` texto, opcionales.
- `started_at`, `finished_at` (fin no anterior a inicio).
- Índice `(project_id, created_at DESC)`.
- Índice único parcial `uq_research_runs_one_active` sobre `project_id` cuando `status` es `pending` o `running`.

**research_queries** — preguntas de la investigación.
- `run_id` FK, CASCADE.
- `position` SMALLINT; `category`; `question` texto; `status` (por defecto `pending`).
- `response_text` opcional; `executed_queries` JSONB array (por defecto `[]`).
- `search_suggestions_html` opcional (se muestra solo en iframe sandbox).
- `completed_at` opcional.
- Único `(run_id, position)`.

**sources** — páginas web encontradas, una vez por proyecto.
- `project_id` FK, CASCADE. Único `(id, project_id)`.
- `url` texto; `canonical_url` texto (sin rastreo, sin `www.`).
- `domain` VARCHAR(255); `title` opcional; `source_type` (por defecto `unknown`); `published_at` opcional.
- Único `(project_id, canonical_url)`. Índice `(project_id, domain)`.

**research_query_sources** — qué fuentes usó cada pregunta.
- Llave primaria compuesta `(query_id, source_id)`; ambas FK con CASCADE.
- `was_cited` booleano; `rank` SMALLINT opcional.

**evidence** — fragmentos citados.
- `project_id` FK, CASCADE; `source_id` con llave compuesta a `sources (id, project_id)`, CASCADE.
- `query_id` FK opcional, CASCADE.
- `evidence_kind`; `content` texto; `span_start`, `span_end` opcionales.
- Regla: `span_start >= 0` y `span_end > span_start` cuando existen. Una `cited_claim` exige `query_id` y `span_start`.

**findings** — hallazgos.
- `project_id` FK, CASCADE. `run_id` opcional con llave compuesta a `research_runs (id, project_id)`, CASCADE.
- `finding_type` (categoría); `statement` texto.
- `confidence_level` (por defecto `undetermined`); `confidence_score` NUMERIC(3,2) entre 0 y 1; `confidence_rationale` opcional.
- `origin`, `review_status` (por defecto `proposed`), `created_at`, `updated_at`.
- Regla: `origin = 'user' OR run_id IS NOT NULL`.
- Índice `(project_id, finding_type)`.

**finding_evidence** — hallazgo a evidencia.
- Llave compuesta `(finding_id, evidence_id)`, CASCADE; `stance` (`supports`, `contradicts`, `context`).

**entities** — empresas, productos, tecnologías y organizaciones.
- `project_id` FK, CASCADE. Único `(id, project_id)`.
- `entity_type`; `name` VARCHAR(200); `normalized_name` VARCHAR(200); `website` opcional; `description` opcional.
- Único `(project_id, entity_type, normalized_name)`. Índice GIN con `gin_trgm_ops` sobre `normalized_name`.

**entity_aliases** — otros nombres de una entidad.
- `entity_id` FK, CASCADE; `alias` VARCHAR(200); `normalized_alias` VARCHAR(200).
- Único `(entity_id, normalized_alias)`. Índice GIN con trigramas.

**finding_entities** — hallazgo a entidad.
- Llave compuesta `(finding_id, entity_id)`, CASCADE.

**competitors** — entidades clasificadas como competidoras.
- `project_id` FK, CASCADE; `entity_id` con llave compuesta a `entities (id, project_id)`, CASCADE.
- `run_id` opcional con llave compuesta a `research_runs`, SET NULL en `run_id`.
- `competitor_type`; `rationale` opcional (análisis, no hecho); `threat_level` (por defecto `undetermined`).
- `origin`, `review_status`.
- Único `(project_id, entity_id)`.

**opportunities** — ventajas posibles.
- `project_id` FK, CASCADE; `run_id` opcional, SET NULL.
- `title` VARCHAR(200); `description` texto; `potential` (por defecto `undetermined`).
- `origin`, `review_status`, `created_at`, `updated_at`.

**risks** — riesgos.
- `project_id`, `run_id` (igual que opportunities).
- `title` VARCHAR(200); `description`; `category`; `likelihood` y `impact` (por defecto `undetermined`); `mitigation` opcional.
- `origin`, `review_status`, `created_at`, `updated_at`.

**validation_hypotheses** — afirmaciones por comprobar.
- `project_id`, `run_id`.
- `statement`; `related_attribute` opcional; `validation_method`, `success_criteria` opcionales; `priority` (por defecto `medium`); `validation_status` (por defecto `pending`); `result_notes` opcional.
- `origin`, `review_status`, `created_at`, `updated_at`.

**missing_information** — preguntas sin respuesta.
- `project_id`, `run_id`.
- `question`; `reason` opcional; `related_attribute` opcional; `priority` (por defecto `medium`); `resolution_status` (por defecto `open`); `resolution_notes` opcional.
- `origin`, `review_status`, `created_at`, `updated_at`.

**opportunity_findings**, **risk_findings**, **hypothesis_findings** — uniones con hallazgos.
- Llave compuesta `(elemento, finding_id)`. Todas con CASCADE.

**reports** — informes versionados.
- `project_id` FK, CASCADE; `run_id` opcional, SET NULL (llave compuesta).
- `version` entero mayor que 0, único por proyecto.
- `title` VARCHAR(200); `geographic_scopes` JSONB array (por defecto `[]`).
- `status` (por defecto `generating`); `ai_provider`, `ai_model`; `error_code` opcional; `completed_at` opcional.

**report_sections** — partes del informe.
- `report_id` FK, CASCADE.
- `section_type`; `position` SMALLINT; `title` VARCHAR(200); `content` Markdown; `verdict` JSONB opcional (solo en el resumen).
- Únicos `(report_id, position)` y `(report_id, section_type)`.

**ai_api_logs** — bitácora de cada llamada a la IA.
- `user_id`, `project_id`, `research_run_id`: FK con SET NULL, para conservar el registro sin identidad.
- `provider`, `model`, `operation`, `prompt_version` opcional, `status`, `error_code` opcional.
- `input_tokens`, `output_tokens` opcionales; `search_queries_count` entero ≥ 0 (por defecto 0); `latency_ms` opcional; `estimated_cost_usd` NUMERIC(12,8) opcional.
- Restricción: todos los conteos y costos no negativos.
- Índices `(user_id, created_at DESC)` y `(created_at)`.

### B.4 Migraciones (`backend/alembic/versions/`)

1. `20260923_a1b3ade021f1_initial_schema.py` — esquema inicial.
2. `20261014_95f14ef1a15d_add_ollama_provider_and_ai_cost.py` — agrega `ollama` y costo estimado.
3. `20261026_3f9c5a1b2d4e_add_report_verdict.py` — agrega `report_sections.verdict`.
4. `20261026_c2149f7d8a31_link_supabase_users.py` — agrega `users.supabase_user_id`.
5. `20261106_d8a24b6e91c0_native_ideaforge_engine.py` — cabeza actual. Convierte `gemini` y `ollama` a `legacy` en `research_runs.ai_provider`, `reports.ai_provider` y `ai_api_logs.provider`. Las restricciones aceptan `engine`, `fake` y `legacy`.

Comandos: `uv run alembic upgrade head`, `uv run alembic downgrade -1`, `uv run alembic current`.

Al crear una migración nueva, revisarla a mano: autogenerate no detecta cambios en CHECK ni en triggers.

### B.5 Script de primera vez

`ideaforge_setup.sql` (en la raíz) crea el usuario `ideaforge`, las bases `ideaforge_dev` e `ideaforge_test` y toda la estructura, sin datos. Se ejecuta con `psql -U postgres -f ideaforge_setup.sql`. Antes hay que reemplazar la contraseña marcada como `CAMBIAR_ESTA_CONTRASENA`. Si las bases ya existen, el script falla en `CREATE DATABASE`: no repetirlo sin revisar.

---

## ANEXO C — API REST

Prefijo: `/api/v1`. Todas las rutas de proyecto requieren Bearer token de Supabase y responden 404 si el proyecto no pertenece al usuario.

### C.1 Salud y usuario

- `GET /health` — estado del servicio.
- `GET /health/db` — estado de la base de datos.
- `GET /perfil` — datos de la persona conectada.
- `GET /users/me` — datos de la persona conectada.
- `PATCH /users/me` — actualizar datos propios.
- `PUT /users/me/password` — cambio de contraseña heredado (solo si `LEGACY_AUTH_ENABLED=true`).

### C.2 Autenticación heredada (solo si `LEGACY_AUTH_ENABLED=true`)

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.

### C.3 Proyectos

- `GET /projects` — listado paginado (`?estado=&pagina=`).
- `POST /projects` — crea un proyecto con su idea (201).
- `GET /projects/summary` — total y cantidad por etapa.
- `GET /projects/{id}` — detalle con atributos y estado de la estructura.
- `PATCH /projects/{id}` — editar título o idea.
- `DELETE /projects/{id}` — borra el proyecto y todo lo que cuelga de él (204). Con investigación activa responde 409 `research_in_progress`.
- `GET /projects/{id}/attributes`, `POST /projects/{id}/attributes`, `PATCH /projects/{id}/attributes/{attribute_id}`, `DELETE /projects/{id}/attributes/{attribute_id}`.
- `POST /projects/{id}/confirm-structure` — pasa de `draft` a `structured` (reglas en la sección D.8 del Anexo D).

### C.4 Investigación

- `POST /projects/{id}/research-runs` — inicia la investigación en segundo plano (202).
- `GET /projects/{id}/research-runs` — listado.
- `GET /projects/{id}/research-runs/{run_id}` — estado y avance.
- `GET /projects/{id}/sources` — fuentes del proyecto.
- `POST /projects/{id}/research-runs/{run_id}/analysis` — genera oportunidades, riesgos, hipótesis e información faltante a partir de la investigación.
- `GET /projects/{id}/analysis` — análisis del proyecto, con `run_id` opcional.

### C.5 Hallazgos, entidades y competidores

- `GET /projects/{id}/findings`, `POST /projects/{id}/findings` (201).
- `PATCH /projects/{id}/findings/{finding_id}` — editar; revisar (aceptar o rechazar) o convertir a `origin=user`.
- `DELETE /projects/{id}/findings/{finding_id}` — 204. Un hallazgo de la IA no se borra: 409 `ai_item_not_deletable`.
- `GET /projects/{id}/entities`.
- `GET /projects/{id}/competitors`, `POST /projects/{id}/competitors`.
- `PATCH /projects/{id}/competitors/{competitor_id}`, `DELETE /projects/{id}/competitors/{competitor_id}`.

### C.6 Chat y reportes

- `POST /projects/{id}/chat` — pregunta al asistente del proyecto.
- `POST /projects/{id}/reports` — inicia un informe (202).
- `GET /projects/{id}/reports` — lista de versiones.
- `GET /projects/{id}/reports/{report_id}` — detalle con secciones y veredicto.

### C.7 Geografía

- `GET /geo/geocode` — búsqueda manual de una ubicación con Nominatim.
- `GET /projects/{id}/geo/places` — lugares cercanos con Overpass. Parámetros: latitud, longitud, `radius_m` (100 a 5000; por defecto 1000), categoría y palabra clave.

### C.8 Administración (solo `role = admin`; 403 para el resto)

- `GET /admin/overview` — resumen y métricas.
- `GET /admin/users` — cuentas.
- `PATCH /admin/users/{id}` — cambiar rol o estado.
- `DELETE /admin/users/{id}` — eliminar cuenta (requiere confirmación; también elimina la identidad en Supabase con `SUPABASE_SERVICE_ROLE_KEY`).
- Laboratorio, bajo `/admin/lab`:
  - `GET /admin/lab/metrics`, `GET /admin/lab/propositions`, `GET /admin/lab/learning`, `GET /admin/lab/projects`.
  - `GET /admin/lab/projects/{id}/trace`, `POST /admin/lab/projects/{id}/trace/path`.
  - `POST /admin/lab/projects/{id}/places`, `POST /admin/lab/projects/{id}/route`, `POST /admin/lab/projects/{id}/budget-plan`.

### C.9 Códigos de respuesta

| Código | Uso |
|---|---|
| 200 | lectura o actualización correcta |
| 201 | recurso creado |
| 202 | operación aceptada en segundo plano |
| 204 | eliminado |
| 401 | sin token válido |
| 403 | sin permiso de administración |
| 404 | recurso inexistente o no perteneciente al usuario |
| 409 | conflicto: `research_in_progress`, `ai_item_not_deletable` |
| 422 | datos inválidos |
| 429 | límite de uso alcanzado (investigaciones por día, intentos de login) |

Todos los errores usan el formato `{"error": {"code", "message", "details?"}}`.

---

## ANEXO D — MOTOR DE IA Y REGLAS DE NEGOCIO

### D.1 Qué hace el motor

El motor (`app/modules/ai/providers/engine.py`, clase `IdeaForgeEngineProvider`) hace:

1. **Planificar la investigación** (`_plan_research`): formula preguntas según atributos de la idea, sector, cliente y zona. Máximo `RESEARCH_MAX_QUESTIONS`. Versión de prompt `research_planning.v1`.
2. **Buscar y citar** (`generate_grounded`, `web_search.py`): consulta DuckDuckGo y Wikipedia ES, puntúa oraciones con TF-IDF y similitud coseno frente a la consulta, sintetiza afirmaciones con `CitationSpan`. Versión de prompt `grounded_search.v2`.
3. **Sintetizar desde la web** (`_synthesize_web_statements`).
4. **Extraer** (`_extract_findings_and_entities`): `ExtractionResult` con evidencia numerada `[E#]`.
5. **Razonar** (`_infer_business_analysis`): encadenamiento hacia adelante sobre `[E#]` y `[H#]` para deducir oportunidades, riesgos, hipótesis, competidores e información faltante.
6. **Predecir el veredicto** (`_predict_report_verdict`): índice multicriterio de viabilidad e incertidumbre; rango de inversión en MXN solo con referencias de costos o precios; recomendaciones por zona (`_build_zone_recommendations`).
7. **Responder el chat** (`_reason_chat_answer`): ranking BM25/TF-IDF sobre el contexto del proyecto.
8. **Respaldo genérico** (`_generic_structured_fallback`): resultado estructurado válido cuando una operación no tiene regla específica.

El motor puede equivocarse. Por eso existen trazabilidad, revisión humana y niveles de confianza limitados.

### D.2 Investigación (`app/modules/research/`)

Flujo:

```
POST /research-runs (202) → run pending
  ↓ running
  ↓ planning    → ResearchPlan (preguntas)
  ↓ searching   → búsqueda pública, en paralelo (semáforo: AI_MAX_CONCURRENCY)
  ↓ extracting  → hallazgos, entidades y competidores con evidencia
  ↓ analyzing / scoring
  ↓ completed | failed | interrupted
```

Reglas:
- Iniciar exige que el proyecto esté en `structured`, `researching` o `analyzed`. Al iniciar pasa a `researching`.
- Al completar queda en `researching`. Al generar el análisis (Anexo C.4) pasa a `analyzed`.
- Si falla, vuelve a `structured`.
- Solo un run activo por proyecto (índice único parcial).
- Al arrancar el backend, los runs activos pasan a `interrupted` si `RESEARCH_RECOVER_ON_STARTUP` es verdadero.
- Límite diario por usuario: `RESEARCH_MAX_RUNS_PER_DAY`; excederlo responde 429.
- La sesión de base de datos del run es propia; la sesión solo se usa desde el bucle principal.
- Las URLs se normalizan (`research/urls.py`) y las fuentes se guardan con upsert por URL canónica.
- Los datos del usuario se envían entre `<idea>...</idea>` y se tratan como datos, nunca como instrucciones.
- Los prompts están versionados en `research/prompts.py`. Al cambiarlos, sube la versión.

### D.3 Extracción y revisión (fase 10)

- Se descarta todo hallazgo sin al menos una evidencia `supports`.
- Las entidades solo se crean si su nombre aparece en las respuestas. Se deduplican con `entities/normalize.py`.
- La confianza es el nivel que propone el motor, limitado por `findings/confidence.py`: con un solo dominio o con evidencia en contra, el máximo es `medium`.
- Hallazgos y competidores de la IA se aceptan o rechazan. No se borran.
- Editar el contenido de un elemento de la IA lo convierte en `origin=user` y `review_status=accepted`.
- Un competidor revisado o del usuario nunca se sobrescribe con una investigación nueva.
- Los hallazgos y competidores manuales tienen `origin=user`.
- Si la extracción falla: run `completed` con `error_code=extraction_failed`.

### D.4 Análisis (fase 11)

- Se genera desde `POST /projects/{id}/research-runs/{run_id}/analysis`.
- Cada elemento se vincula a los hallazgos que lo respaldan.
- Elementos generados por el motor: `origin=ai`, `review_status=proposed`.

### D.5 Estimación de inversión

- Se junta el conjunto de cifras de precios y costos de los hallazgos aceptados.
- Se descartan las cifras atípicas con la regla IQR: fuera de `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]`.
- Con menos de 4 cifras no se filtra.
- Solo se estima inversión si hay referencias de costos o precios. Si no las hay, no se inventa un rango.

### D.6 Chat (fase 13)

- `chat/service.py` arma el contexto limitado del proyecto y llama a `AIOrchestrator` con `AIOperation.CHAT`.
- Los hallazgos citados se filtran por pertenencia al proyecto.
- No ejecuta búsquedas web ni crea datos geográficos.
- Los saludos breves se responden sin llamar al motor.
- El historial enviado por el cliente es limitado y no se persiste.

### D.7 Informes y veredicto (fase 14)

- `POST /projects/{id}/reports` (202) crea un informe con la siguiente versión del proyecto y lo genera en segundo plano.
- El veredicto (`BusinessVerdict`, en `reports/schemas.py`) recomienda: probar, validar más, no avanzar todavía o datos insuficientes. No promete éxito.
- Entrada del informe: hasta 3 zonas geográficas (`geographic_scopes`, máximo 3), con radio entre 100 y 5000 metros.
- La respuesta del veredicto puede incluir hasta 4 recomendaciones de zona (`ZoneRecommendation`).
- El veredicto se guarda en `report_sections.verdict` (JSONB). El contenido completo se guarda en `content` (Markdown).
- Las referencias OSM se citan con `G#` y quedan como fuentes.
- El detalle completo queda plegado debajo del veredicto.
- Exportación: Markdown y PDF por impresión desde el navegador.
- Si cambia el esquema del veredicto, actualizar `_predict_report_verdict` en `providers/engine.py` y sus pruebas.

### D.8 Proyecto: estructura de la idea (fase 8)

- `draft` → `structured` solo con `POST /projects/{id}/confirm-structure`.
- Para confirmar se exige: problema, solución y segmento, cada uno con al menos un valor confirmado, y ninguna sugerencia de IA pendiente (`check_structure` en `projects/service.py`).
- Editar `raw_idea` o cualquier atributo devuelve el proyecto a `draft` desde cualquier estado. El título no lo cambia.
- Con investigación activa, editar la idea o los atributos, o borrar el proyecto, responde 409 `research_in_progress`.

---

## ANEXO E — FRONTEND

### E.1 Estructura

- `src/app`: router (`router.tsx`) y providers.
- `src/components/ui`: sistema de diseño.
- `src/components/layout`: `AppShell`.
- `src/features/<modulo>`: `admin` (con `lab/`), `analysis`, `auth`, `chat`, `dashboard`, `findings`, `geo`, `projects`, `reports`, `research`, `settings`, `visualizations`.
- `src/lib`: `apiClient.ts`, `supabaseClient.ts`, `queryClient.ts`.
- `src/test/render.tsx`: `renderRoutes` y `apiRoutes` para simular la API por método y ruta.

### E.2 Rutas

Públicas (solo invitados; si hay sesión, redirigen al panel):
- `/iniciar-sesion`
- `/registro`

Privadas (requieren sesión; si no hay, redirigen a iniciar sesión):
- `/` — panel (`DashboardPage`).
- `/proyectos` — listado (`?estado=&pagina=`).
- `/proyectos/nuevo`.
- `/configuracion` — cuenta, correo, selector de tema claro u oscuro, instalación PWA y cerrar sesión.

Solo administradoras (`RequireAdmin`):
- `/admin`
- `/admin/laboratorio`
- `/admin/laboratorio/proposiciones`

Detalle del proyecto (`/proyectos/:projectId`), con pestañas:
- índice (la idea, pestaña por defecto),
- `/investigacion`,
- `/hallazgos`,
- `/competidores`,
- `/analisis`,
- `/asistente`,
- `/fuentes`,
- `/visualizaciones`,
- `/reportes` (veredicto).

Ruta `*`: página 404.

### E.3 Reglas de interfaz

- Textos de la interfaz en español. Las etiquetas de enumeraciones están en `src/features/projects/constants.ts`.
- Todas las llamadas HTTP pasan por `apiRequest` (`src/lib/apiClient.ts`): añade el token de Supabase, convierte errores en `ApiError` y renueva la sesión.
- Datos del servidor con TanStack Query. Claves en `projectKeys` (`src/features/projects/queries.ts`). Cada mutación invalida `["projects"]`.
- Polling cada 2 segundos mientras una investigación está activa.
- `CitedText` resalta solo los spans con evidencia. Los enlaces externos solo aceptan http y https (`safeHref`). Search Suggestions se muestran en un iframe sandbox.
- **Nunca** usar `dangerouslySetInnerHTML` con contenido de la API o de la IA.
- Los nombres y versiones de modelo solo aparecen en la bitácora administrativa.
- `/reportes` oculta los apartados técnicos hasta que el usuario pide ver el análisis completo.
- En `/proyectos`, cada tarjeta tiene borrado confirmado.
- Onboarding: una cuenta sin proyectos ve una ruta de 5 pasos con una sola acción principal. Dentro de cada proyecto, los pasos principales se separan de las herramientas opcionales.
- Si Vitest falla con "Timeout waiting for worker to respond", es el arranque lento de OneDrive: reintentar.

### E.4 Tests del frontend

- Vitest + Testing Library. Pruebas en `*.test.tsx` y `*.test.ts`.
- Simular la API con `apiRoutes` y `renderRoutes`.
- Verificación: `npx vitest run` debe reportar 62 pruebas en 17 archivos.

---

## ANEXO F — PRUEBAS, COMANDOS Y CRITERIOS DE ACEPTACIÓN

### F.1 Backend

Desde `backend/`, con `UV_PROJECT_ENVIRONMENT` fuera de OneDrive:

```powershell
$env:UV_PROJECT_ENVIRONMENT = "$env:USERPROFILE\.venvs\ideaforge-backend"
uv sync
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --reload-dir app --port 8000
```

- `--reload-dir app` evita reinicios cuando se ejecutan pruebas o cambia `.venv`.
- Las pruebas de base de datos usan `TEST_DATABASE_URL` y se vacían en cada ejecución. Fixtures en `tests/conftest.py`: `migrated_db`, `db_app`, `db_client`, `run_sql`, `fetch_scalar`. Tras cada prueba de API se ejecuta `TRUNCATE users CASCADE`.
- `tests/db/test_schema.py` verifica que modelos y migraciones coinciden (`compare_metadata`).
- Ayudas para pruebas de API en `tests/api/helpers.py` (`user_headers`, `registered_tokens`, ...).

### F.2 Frontend

Desde `frontend/`:

```powershell
npm install
npm run dev
npm run typecheck
npx vitest run
npm run build
```

- `npm run dev` levanta en `http://localhost:5173` con proxy de `/api` al puerto 8000.

### F.3 Criterios de aceptación del estado actual

| Comprobación | Resultado esperado |
|---|---|
| `uv run alembic current` | `d8a24b6e91c0 (head)` |
| `uv run pytest -q` | 220 passed (unos 4 minutos) |
| `uv run ruff check .` | All checks passed |
| `uv run ruff format --check .` | archivos ya formateados |
| `npm run typecheck` | exit 0 |
| `npx vitest run` | 62 passed en 17 archivos |
| `npm run build` | exit 0 (aviso de chunk mayor a 500 kB; no es fallo) |
| Tablas de dominio | 25, más `alembic_version` |
| Llaves foráneas | 33 |
| Triggers `trg_*_updated_at` | 11 |

---

## ANEXO G — LABORATORIO Y APRENDIZAJE (SOLO ADMINISTRACIÓN)

### G.1 Regla de selección de algoritmos

Se conserva lo que ayuda a validar ideas o a medir el motor. Se quita lo que solo ilustra un tema del curso o no cambia ningún resultado del proyecto.

### G.2 Conservados (`app/modules/admin/lab/algorithms.py`)

- **BFS** (`find_trace_path`): camino más corto en pasos por el grafo de trazabilidad (idea → atributos → fuentes → evidencias → hallazgos → análisis).
- **Haversine** (`haversine_km`): distancia en kilómetros sobre la superficie terrestre. Es la fórmula correcta para coordenadas.
- **Ruta exacta** (método `exact`, hasta 8 paradas) y **vecino más cercano** en `optimize_project_place_route`.
- **Presupuesto exacto** y **voraz** en `optimize_hypothesis_budget` (valor esperado sujeto a presupuesto).
- **Tablas de verdad** y **PEAS** en la página de proposiciones.

### G.3 Quitados

- DFS, búsqueda voraz y A* de trazabilidad (la "pista" por nivel era una convención inventada).
- Escalada, 2-opt y genético para rutas (con 8 paradas o menos, el exacto basta).
- Escalada para presupuesto (con 16 hipótesis como máximo, el exacto basta).
- Calendario por turnos (venía de otra aplicación y no valida ideas).
- La distancia euclidiana no se usa con coordenadas geográficas.

### G.4 Filtro IQR (implementado)

Ver D.5.

### G.5 Árbol de decisión (implementado; sin datos suficientes)

- `app/modules/ai/learning/decision_tree.py`: árbol CART en Python puro, con impureza de Gini. Sin scikit-learn.
- Parámetros: `max_depth = 3`, `min_samples_leaf = 3`.
- Objetivo: predecir si una persona aceptará o rechazará un hallazgo propuesto por la IA.
- Rasgos (`learning/features.py`): confianza, número de evidencias, evidencias de apoyo y de contraste, dominios distintos, presencia y tipo de cifras.
- Evaluación (`learning/evaluation.py`): separación determinista con semilla fija; 60 % entrenamiento, 20 % validación y 20 % prueba. Métricas: matriz de confusión, precisión, exhaustividad y F1.
- Compuerta (`learning/report.py`): `MIN_PER_CLASS = 20`. No entrena hasta tener al menos 20 hallazgos aceptados y 20 rechazados.
- Estado actual: 0 hallazgos revisados como aceptados o rechazados. Hay 4 propuestos pendientes. El árbol no entrena todavía y no cambia lo que ve la persona: solo informa.
- Endpoint: `GET /api/v1/admin/lab/learning`.
- Bosque aleatorio y KNN no se implementan: con los datos actuales no aportan.

### G.6 Páginas

- `/admin/laboratorio`: métricas, trazas, rutas y presupuesto.
- `/admin/laboratorio/proposiciones`: proposiciones y tablas de verdad.

---

## ANEXO H — DESPLIEGUE (FASE 17, EN PAUSA)

Objetivo acordado: desplegar solamente el frontend.

- Frontend: Vercel, con raíz `frontend` y preset Vite. `frontend/vercel.json` redirige rutas SPA al shell.
- Variables en Vercel: `VITE_API_URL` (URL HTTPS del túnel más `/api/v1`), `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Backend y PostgreSQL: en la computadora del usuario. Se exponen mediante un túnel HTTPS. Para usarlo desde otros dispositivos, la computadora, el backend y el túnel deben permanecer encendidos.
- No abrir puertos del router.
- CORS: limitar `CORS_ORIGINS` al dominio publicado.
- Mantener la autenticación de la API.
- Pendiente: elegir el proveedor de hosting del frontend y el del túnel.

---

## ANEXO I — PENDIENTES Y RIESGOS CONOCIDOS

- **Respaldos:** `pg_dump` funciona, pero no hay tarea programada ni almacenamiento externo (PROPUESTA). `archive_mode` está apagado en el entorno local.
- **Limpieza de tokens vencidos:** sin tarea programada (PROPUESTA).
- **Restauración:** el usuario `ideaforge` no puede crear bases (`rolcreatedb=f`). Las pruebas de restauración deben hacerse con un usuario que tenga ese permiso, o con `pg_restore` sobre una base ya creada.
- **SSL** apagado en el entorno local: aceptable solo en local.
- **Limitador de login en memoria:** válido solo para un proceso (fase 17).
- **Árbol de decisión:** requiere al menos 20 hallazgos aceptados y 20 rechazados por clase.
- **Cambios recientes:** los cambios posteriores a la fase 16 estaban sin commit en el árbol de trabajo. Revisar `git status` antes de confirmar.

---

## ANEXO J — PARA COMPRENDER EL ESTADO SIN EL HISTORIAL

Estas son las decisiones que no deben revertirse por accidente:

1. La IA es el motor propio en Python. Gemini, Ollama y Grok están retirados.
2. Los proveedores históricos quedan como `legacy` en la base de datos. No se borran registros.
3. El proveedor `fake` existe solo para pruebas y está prohibido en producción.
4. La geografía usa OpenStreetMap, Nominatim y Overpass, detrás de un proveedor intercambiable.
5. Un lugar de OSM no es un competidor hasta que se clasifica con evidencia.
6. Todo lo que genera la IA se marca como propuesto hasta que una persona lo revisa.
7. La propiedad de un proyecto se verifica en el servicio y, si no coincide, se responde 404.
8. El veredicto nunca promete éxito y solo estima inversión con referencias de costos.
9. El árbol de decisión solo entrena con al menos 20 revisiones por clase.
10. La autenticación es Supabase; el rol de administrador es local (`users.role`).
