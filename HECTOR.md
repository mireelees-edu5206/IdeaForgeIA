# Prácticas de Hector: qué usamos, qué quitamos y por qué

Este documento revisa las prácticas de Hector (los dos `.rar` del 04/11 y 11/11 y la carpeta
`TODO\Practicas Hector`) contra el código de IdeaForge AI. Para cada técnica explica **qué mide**,
**qué devuelve** y **si se conserva**. Si no se usa, dice por qué.

La regla que usamos: **se conserva lo que ayuda a validar ideas o a medir al motor de IA; se quita lo
que solo ilustra un tema del curso o que no cambia ningún resultado del proyecto.**

---

## 1. De dónde viene cada cosa

| Archivo de Hector | Tema | Dónde quedó en IdeaForge |
|---|---|---|
| `p01BFS.py` | Búsqueda en anchura (BFS) en un mapa | Trazabilidad del laboratorio (**conservado**) |
| `p21busquedaciegadfs.py`, `p05mapa_dfs.py` | Búsqueda en profundidad (DFS) | Quitado |
| `Examenunidad2.py` | Búsqueda voraz, A* y heurísticas | Quitado (heurística sin significado real) |
| `Campus.py`, `Robot.py` | Rutas TSP, escalada, genético, distancia euclidiana | Rutas: exacto y vecino más cercano (**conservados**); escalada, 2-opt y genético quitados |
| `Turnos.py` | Asignación de turnos con escalada | Calendario por turnos (**quitado**) |
| `01ialogicapropo.py`, `00Tabla_de_la_verdad.py` | Lógica proposicional, tablas de verdad, PEAS | Página "Proposiciones y tablas" (**conservada**, es documentación de las reglas) |
| `p01reglafija.PY` | Regla fija para decidir | Concepto de reglas del motor (no hay código nuevo) |
| `p02*` (cinco archivos) | Análisis, limpieza y calidad de datos | Filtro de cifras atípicas en el motor (**implementado**) |
| `p03primermodelo.py` | Árbol de decisión | No se usa todavía (ver sección 4) |
| `p04entrenamiento_validacion_prueba.py` | Entrenamiento, validación y prueba | No se usa todavía (ver sección 4) |
| `p05algoritmosmachinelearning.py` | Árbol, bosque aleatorio y KNN | No se usa todavía (ver sección 4) |

Nota: en los `.rar`, `p03primermodelo.py` tiene 481 líneas, pero la versión de la carpeta tiene 920 y
es más reciente (incluye una interfaz gráfica). Revisamos la versión de la carpeta.

---

## 2. Algoritmos de búsqueda y rutas

### Búsqueda en anchura (BFS) — conservado
- **Qué mide:** el número de pasos (conexiones) desde la raíz del proyecto hasta un nodo del grafo de
  trazabilidad (idea → atributos → fuentes → evidencias → hallazgos → análisis).
- **Qué devuelve:** el camino con menos pasos y la lista de nodos revisados, en orden.
- **Por qué se conserva:** es la única búsqueda que garantiza el camino más corto en pasos, sin
  depender de ninguna pista. Sirve para explicar de dónde sale un hallazgo.
- **Dónde está:** `backend/app/modules/admin/lab/algorithms.py` → `find_trace_path`.

### Búsqueda en profundidad (DFS) — quitado
- **Qué hacía:** se metía hasta el fondo de una rama antes de volver.
- **Por qué se quitó:** no garantiza el camino más corto; en este grafo, BFS da el mismo resultado
  con una garantía que DFS no tiene.

### Búsqueda voraz y A* — quitados
- **Qué hacían:** usaban como "pista" la diferencia de nivel entre un nodo y el objetivo (idea = 0,
  fuente = 3, competidor = 5).
- **Por qué se quitaron:** esa pista es una convención inventada, no mide nada real del camino. El
  propio código lo decía ("es una pista, no medida exacta"). A* solo garantiza el camino corto si la
  pista nunca exagera, y aquí no se puede asegurar.

### Distancia de Haversine — conservada
- **Qué mide:** la distancia en línea recta sobre la superficie de la Tierra, en kilómetros, entre dos
  coordenadas (latitud y longitud).
- **Qué devuelve:** un número en km. Es la distancia "en el aire", no por calles.
- **Por qué se conserva:** es la fórmula correcta para coordenadas geográficas. Se usa en las rutas del
  laboratorio y en la búsqueda de lugares.

### Distancia euclidiana — no se usa, y por qué
- **Qué mide:** la distancia en línea recta sobre un plano: `√((x₂−x₁)² + (y₂−y₁)²)`. Aparece en
  `Robot.py` como "Distancia Euclidiana".
- **Por qué no la usamos:** con latitud y longitud en grados, un grado de longitud no mide lo mismo que
  un grado de latitud. A la latitud de Toluca (≈19.3°), un grado de latitud son ≈110.6 km, y un grado
  de longitud son ≈105.1 km. Si se usa la fórmula plana, las distancias salen torcidas. Haversine
  corrige esa curvatura.
- **Cuándo sí serviría:** en un plano real (por ejemplo, un mapa de un solo edificio en metros). No es
  nuestro caso.

### Ruta exacta (probar todos los órdenes) — conservada
- **Qué mide:** la distancia de ida y vuelta de un orden de visita, sumando los tramos con Haversine.
- **Qué devuelve:** el orden más corto, que sirve de referencia para comparar.
- **Costo:** con 8 paradas son 8! = 40 320 órdenes, que se calculan en milisegundos. Por eso el límite
  de 8 lugares.
- **Dónde está:** `optimize_project_place_route`, método `exact`.

### Vecino más cercano — conservado como referencia rápida
- **Qué hace:** siempre pasa a la parada más cercana que todavía falta.
- **Qué devuelve:** una ruta rápida, casi nunca la más corta. Sirve para ver cuánto se pierde frente a la
  ruta exacta.

### Escalada (hill climbing), 2-opt y algoritmo genético — quitados
- **Qué hacían:** partían de una ruta al azar y mejoraban con cambios pequeños (escalada, 2-opt) o con
  selección natural (genético).
- **Por qué se quitaron:** con 8 paradas o menos, la ruta exacta ya es rápida y óptima. Estos métodos
  pueden quedarse atrapados en una solución "buena pero no la mejor", y no aportan nada que el exacto no
  dé mejor. Además el genético depende de una semilla aleatoria.

### Calendario por turnos (escalada) — quitado
- **Qué hacía:** repartía validaciones entre turnos matutino, vespertino y nocturno.
- **Por qué se quitó:** viene de una app de rotación de personal (`Turnos.py`). No ayuda a validar una
  idea de negocio.

---

## 3. Presupuesto de hipótesis (selección tipo mochila)

Este módulo no viene de las prácticas: es trabajo propio del proyecto. Pero usaba escalada, que se quitó.

### Óptimo exacto — conservado
- **Qué mide:** el valor total esperado de una combinación de hipótesis, siempre que su costo total no
  supere el presupuesto.
- **Qué devuelve:** la combinación con mayor valor. Con 16 hipótesis son 2^16 = 65 536 combinaciones.

### Voraz por valor y costo — conservado
- **Qué hace:** ordena por valor esperado dividido entre costo y toma lo que quepa.
- **Qué devuelve:** una selección rápida, que a veces no es la mejor. Se compara contra el exacto.

### Escalada para presupuesto — quitado
- **Por qué:** con 16 hipótesis como máximo, el exacto es viable, y la escalada puede quedarse en una
  selección que no es la mejor.

---

## 4. Lógica, reglas y técnicas de aprendizaje

### Reglas fijas (`p01reglafija`) — concepto usado
- **Qué hace:** decide con una regla escrita a mano (por ejemplo, "si las horas de estudio son 6 o más,
  aprueba").
- **En IdeaForge:** el motor de IA usa reglas explícitas para clasificar evidencias, derivar riesgos y
  oportunidades y estimar el veredicto. No hay código nuevo que copiar de esta práctica.

### Tablas de verdad, lógica proposicional y PEAS — conservado
- **Qué muestran:** las reglas del sistema como tablas de verdad (por ejemplo, cuándo una idea está
  lista para investigar) y el marco PEAS del agente (medida de desempeño, entorno, actuadores y sensores).
- **Por qué se conservan:** documentan el comportamiento del sistema para quien lo revisa. No cambian
  ningún resultado; se quitarían solo si el profesor no lo pide.

### Limpieza de datos y valores atípicos (`p02*`) — implementado
- **Qué mide:** una cifra es atípica si queda fuera de `[Q1 − 1.5·IQR, Q3 + 1.5·IQR]`, donde `Q1` y `Q3`
  son los cuartiles y `IQR = Q3 − Q1` es el rango intercuartil (regla de Tukey).
- **Dónde se aplica:** al estimar la inversión inicial del veredicto. El motor junta las cifras de
  precios y costos de los hallazgos aceptados. Un solo número mal leído (por ejemplo, 9 000 000 en lugar
  de 9 000) movía todo el promedio.
- **Qué cambia:** antes de promediar, se quitan las cifras atípicas. Con menos de 4 cifras no hay
  dispersión que medir, así que se conservan todas.
- **Pruebas:** `backend/tests/test_ai_providers.py` (`test_iqr_filter_*`).

### Árbol de decisión (`p03`, `p05`) — implementado en Python puro
- **Qué hace:** aprende preguntas del tipo "¿el valor es menor o igual a X?" a partir de ejemplos
  etiquetados, y elige cada pregunta con la impureza de Gini (0 = todos los ejemplos del grupo tienen
  la misma etiqueta).
- **Dónde está:** `backend/app/modules/ai/learning/decision_tree.py`. Sin scikit-learn: son unas
  100 líneas de Python, con profundidad máxima y mínimo de ejemplos por hoja para no memorizar.
- **Qué aprende:** si un hallazgo generado por la IA será aceptado o rechazado por una persona, a partir
  de sus rasgos (`features.py`): confianza, número de evidencias, evidencias de apoyo y de contraste,
  dominios distintos, si menciona cifras y su tipo.
- **Cómo se evalúa:** aprende solo del 60 % de los ejemplos; mide en validación (20 %) y prueba (20 %).
  La matriz de confusión, la precisión, la exhaustividad y el F1 salen de `evaluation.py`.
- **Compuerta:** no entrena hasta tener al menos 20 ejemplos aceptados y 20 rechazados. Es una regla
  práctica del proyecto: con menos, la prueba puede verse perfecta por casualidad.
- **Dónde se ve:** `GET /api/v1/admin/lab/learning` (solo administradores). Pruebas en
  `backend/tests/test_learning.py` y `backend/tests/api/test_admin_lab.py`.
- **Estado real de los datos hoy:** 0 hallazgos de la IA revisados como aceptados o rechazados (hay 4
  propuestos pendientes). El árbol está listo, pero no se entrena todavía. Para que aprenda, hay que
  revisar los hallazgos propuestos en la app (aceptar o rechazar).
- **Por qué no se usa para cambiar las respuestas:** un árbol entrenado con pocos casos no es confiable.
  Hoy solo informa; no modifica lo que ve la persona.

### Bosque aleatorio y KNN (`p05`) — no usados
- **Bosque aleatorio:** muchos árboles votando. Con menos de 40 ejemplos, un solo árbol ya es más de lo
  que los datos sostienen; se agrega cuando haya suficientes revisiones.
- **KNN:** clasifica por vecinos cercanos. Por defecto mide cercanía con la distancia euclidiana, y ya
  vimos que en coordenadas geográficas no conviene. Los rasgos de hallazgos tampoco están en la misma
  escala, así que requeriría normalizarlos primero.
- **Datos de las prácticas:** son sintéticos (números aleatorios). No sirven para evaluar ideas reales.

### Entrenamiento, validación y prueba (`p04`) — implementado
- **Qué hace:** separa los datos en entrenamiento, validación y prueba, mide precisión, exhaustividad y
  F1, y muestra la matriz de confusión. La prueba no se usa para entrenar, para que el resultado sea
  honesto.
- **Dónde está:** `evaluation.py` y `report.py`. El reparto es repetible: misma semilla, mismo reparto.
- **Cuándo tendrá valor:** cuando haya suficientes revisiones humanas. Hoy el informe solo muestra la
  compuerta de datos.

---

## 5. Resumen de cambios

| Qué | Acción | Motivo corto |
|---|---|---|
| DFS, búsqueda voraz y A* (trazabilidad) | Quitado | Sin garantía o con pista inventada |
| Escalada, 2-opt y genético (ruta) | Quitado | Con 8 paradas, el exacto basta |
| Escalada (presupuesto) | Quitado | Con 16 hipótesis, el exacto basta |
| Calendario por turnos | Quitado | Viene de otra app, no valida ideas |
| BFS, Haversine, ruta exacta, vecino más cercano | Conservado | Útiles y con garantías claras |
| Voraz por valor y costo, exacto de presupuesto | Conservado | Útiles como comparación |
| Tablas de verdad y PEAS | Conservado | Documentan las reglas del sistema |
| Filtro IQR de cifras atípicas | Implementado | Mejora la estimación de inversión |
| Árbol de decisión, métricas y compuerta | Implementado | Solo entrena con 20+ revisiones por clase |
| Bosque aleatorio y KNN | No usados | Con los datos actuales no aportan |

Las pruebas del backend (208) y el chequeo de tipos del frontend pasan. Los cambios no están en commit.
