-- IdeaForge AI - Demostración de Inserción de Datos
-- Script para capturas de pantalla
-- Muestra el flujo completo de inserción de datos en el sistema

-- ============================================================
-- PASO 1: Insertar un nuevo usuario
-- ============================================================

INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES (
    uuid_generate_v7(),
    'usuario@ejemplo.com',
    '$2b$12$hash_de_contraseña_segura',
    'Juan Pérez',
    'user',
    TRUE
);

-- Verificar la inserción
SELECT * FROM users WHERE email = 'usuario@ejemplo.com';

-- ============================================================
-- PASO 2: Insertar un nuevo proyecto para el usuario
-- ============================================================

-- Primero obtenemos el ID del usuario
SELECT id FROM users WHERE email = 'usuario@ejemplo.com';

-- Insertamos el proyecto (usando el ID del usuario obtenido)
INSERT INTO projects (id, user_id, title, raw_idea, status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_USUARIO_OBTENIDO',
    'Plataforma de Delivery de Comida Local',
    'Una plataforma de delivery que conecta restaurantes locales con clientes en ciudades pequeñas, ofreciendo precios más bajos que las grandes plataformas y apoyando el comercio local.',
    'draft'
);

-- Verificar la inserción
SELECT * FROM projects WHERE title = 'Plataforma de Delivery de Comida Local';

-- ============================================================
-- PASO 3: Insertar atributos de la idea (estructuración)
-- ============================================================

-- Obtener el ID del proyecto
SELECT id FROM projects WHERE title = 'Plataforma de Delivery de Comida Local';

-- Insertar atributo: Problema
INSERT INTO idea_attributes (id, project_id, attribute_type, value, position, origin, is_confirmed)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'problem',
    'Los restaurantes locales no pueden competir con las grandes plataformas de delivery debido a las comisiones altas y falta de visibilidad.',
    0,
    'user',
    TRUE
);

-- Insertar atributo: Solución
INSERT INTO idea_attributes (id, project_id, attribute_type, value, position, origin, is_confirmed)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'solution',
    'Plataforma de delivery con comisiones más bajas, marketing local y enfoque en ciudades pequeñas.',
    0,
    'user',
    TRUE
);

-- Insertar atributo: Segmento de clientes
INSERT INTO idea_attributes (id, project_id, attribute_type, value, position, origin, is_confirmed)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'customer_segment',
    'Restaurantes locales de ciudades pequeñas (menos de 100,000 habitantes) y clientes que prefieren apoyar el comercio local.',
    0,
    'user',
    TRUE
);

-- Insertar atributo: Modelo de ingresos
INSERT INTO idea_attributes (id, project_id, attribute_type, value, position, origin, is_confirmed)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'revenue_model',
    'Comisión del 10% por pedido (vs 25-30% de competidores), suscripción premium para restaurantes con beneficios adicionales.',
    0,
    'user',
    TRUE
);

-- Verificar todos los atributos insertados
SELECT * FROM idea_attributes WHERE project_id = 'UUID_DEL_PROYECTO' ORDER BY attribute_type, position;

-- ============================================================
-- PASO 4: Crear una ejecución de investigación (research run)
-- ============================================================

-- Insertar ejecución de investigación
INSERT INTO research_runs (id, project_id, status, current_step, progress_pct, ai_provider, ai_model)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'pending',
    'planning',
    0,
    'fake',
    'fake-model-v1'
);

-- Verificar la inserción
SELECT * FROM research_runs WHERE project_id = 'UUID_DEL_PROYECTO' ORDER BY created_at DESC LIMIT 1;

-- ============================================================
-- PASO 5: Insertar consultas de investigación
-- ============================================================

-- Obtener el ID de la ejecución de investigación
SELECT id FROM research_runs WHERE project_id = 'UUID_DEL_PROYECTO' ORDER BY created_at DESC LIMIT 1;

-- Insertar consulta 1: Mercado
INSERT INTO research_queries (id, run_id, position, category, question, status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_RUN',
    1,
    'market',
    '¿Cuál es el tamaño del mercado de delivery de comida en ciudades pequeñas?',
    'pending'
);

-- Insertar consulta 2: Competencia
INSERT INTO research_queries (id, run_id, position, category, question, status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_RUN',
    2,
    'competition',
    '¿Cuáles son las principales plataformas de delivery que operan en ciudades pequeñas?',
    'pending'
);

-- Insertar consulta 3: Precios
INSERT INTO research_queries (id, run_id, position, category, question, status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_RUN',
    3,
    'pricing',
    '¿Cuáles son las comisiones promedio de las plataformas de delivery existentes?',
    'pending'
);

-- Verificar las consultas insertadas
SELECT * FROM research_queries WHERE run_id = 'UUID_DEL_RUN' ORDER BY position;

-- ============================================================
-- PASO 6: Insertar fuentes encontradas durante la investigación
-- ============================================================

-- Insertar fuente 1
INSERT INTO sources (id, project_id, url, canonical_url, domain, title, source_type)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'https://ejemplo.com/articulo-delivery',
    'https://ejemplo.com/articulo-delivery',
    'ejemplo.com',
    'El mercado de delivery de comida en 2024',
    'news'
);

-- Insertar fuente 2
INSERT INTO sources (id, project_id, url, canonical_url, domain, title, source_type)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'https://rappi.com/mexico',
    'https://rappi.com/mexico',
    'rappi.com',
    'Rappi México - Delivery de comida',
    'company_site'
);

-- Insertar fuente 3
INSERT INTO sources (id, project_id, url, canonical_url, domain, title, source_type)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'https://ubereats.com/cities',
    'https://ubereats.com/cities',
    'ubereats.com',
    'Uber Eats - Ciudades disponibles',
    'company_site'
);

-- Verificar las fuentes insertadas
SELECT * FROM sources WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 7: Insertar evidencia encontrada
-- ============================================================

-- Obtener IDs de fuentes y consultas
SELECT id, title FROM sources WHERE project_id = 'UUID_DEL_PROYECTO';
SELECT id, question FROM research_queries WHERE run_id = 'UUID_DEL_RUN';

-- Insertar evidencia 1: Cita con grounding
INSERT INTO evidence (id, project_id, source_id, query_id, evidence_kind, content, span_start, span_end)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_FUENTE_1',
    'UUID_CONSULTA_1',
    'cited_claim',
    'El mercado de delivery de comida en ciudades pequeñas representa el 15% del mercado total de delivery en México.',
    0,
    120
);

-- Insertar evidencia 2: Fragmento de fuente
INSERT INTO evidence (id, project_id, source_id, evidence_kind, content)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_FUENTE_2',
    'source_excerpt',
    'Rappi cobra una comisión del 25% a los restaurantes por cada pedido realizado a través de su plataforma.'
);

-- Verificar la evidencia insertada
SELECT * FROM evidence WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 8: Insertar hallazgos de investigación
-- ============================================================

-- Insertar hallazgo 1: Mercado
INSERT INTO findings (id, project_id, run_id, finding_type, statement, confidence_level, confidence_score, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'market',
    'El mercado de delivery en ciudades pequeñas tiene un potencial de crecimiento del 20% anual.',
    'high',
    0.85,
    'ai',
    'proposed'
);

-- Insertar hallazgo 2: Competencia
INSERT INTO findings (id, project_id, run_id, finding_type, statement, confidence_level, confidence_score, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'competition',
    'Las principales plataformas (Rappi, Uber Eats) tienen comisiones entre 25% y 30%.',
    'high',
    0.90,
    'ai',
    'proposed'
);

-- Insertar hallazgo 3: Precios
INSERT INTO findings (id, project_id, run_id, finding_type, statement, confidence_level, confidence_score, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'pricing',
    'Los restaurantes marginales (pequeños) son los más afectados por las comisiones altas.',
    'medium',
    0.70,
    'ai',
    'proposed'
);

-- Verificar los hallazgos insertados
SELECT * FROM findings WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 9: Insertar entidades identificadas
-- ============================================================

-- Insertar entidad 1: Empresa
INSERT INTO entities (id, project_id, entity_type, name, normalized_name, website, description)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'company',
    'Rappi',
    'rappi',
    'https://rappi.com',
    'Plataforma de delivery de comida líder en Latinoamérica'
);

-- Insertar entidad 2: Empresa
INSERT INTO entities (id, project_id, entity_type, name, normalized_name, website, description)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'company',
    'Uber Eats',
    'uber eats',
    'https://ubereats.com',
    'Servicio de delivery de comida de Uber'
);

-- Insertar entidad 3: Producto
INSERT INTO entities (id, project_id, entity_type, name, normalized_name, description)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'product',
    'Delivery de comida',
    'delivery de comida',
    'Servicio de entrega de comida a domicilio'
);

-- Verificar las entidades insertadas
SELECT * FROM entities WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 10: Insertar competidores
-- ============================================================

-- Obtener IDs de entidades
SELECT id, name FROM entities WHERE project_id = 'UUID_DEL_PROYECTO' AND entity_type = 'company';

-- Insertar competidor 1
INSERT INTO competitors (id, project_id, entity_id, run_id, competitor_type, threat_level, rationale, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_ENTIDAD_RAPPI',
    'UUID_DEL_RUN',
    'direct',
    'high',
    'Rappi es el líder del mercado y tiene cobertura en la mayoría de las ciudades.',
    'ai',
    'proposed'
);

-- Insertar competidor 2
INSERT INTO competitors (id, project_id, entity_id, run_id, competitor_type, threat_level, rationale, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_ENTIDAD_UBER_EATS',
    'UUID_DEL_RUN',
    'direct',
    'high',
    'Uber Eats tiene presencia global y recursos significativos.',
    'ai',
    'proposed'
);

-- Verificar los competidores insertados
SELECT c.id, e.name, c.competitor_type, c.threat_level, c.rationale
FROM competitors c
JOIN entities e ON c.entity_id = e.id
WHERE c.project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 11: Insertar oportunidades identificadas
-- ============================================================

-- Insertar oportunidad 1
INSERT INTO opportunities (id, project_id, run_id, title, description, potential, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Mercado de ciudades pequeñas poco atendido',
    'Las grandes plataformas se enfocan en ciudades grandes, dejando una oportunidad en ciudades pequeñas.',
    'high',
    'ai',
    'proposed'
);

-- Insertar oportunidad 2
INSERT INTO opportunities (id, project_id, run_id, title, description, potential, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Diferenciación por precios',
    'Ofrecer comisiones más bajas puede atraer restaurantes que actualmente no usan plataformas de delivery.',
    'high',
    'ai',
    'proposed'
);

-- Insertar oportunidad 3
INSERT INTO opportunities (id, project_id, run_id, title, description, potential, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Apoyo al comercio local',
    'Los consumidores cada vez valoran más apoyar negocios locales.',
    'medium',
    'ai',
    'proposed'
);

-- Verificar las oportunidades insertadas
SELECT * FROM opportunities WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 12: Insertar riesgos identificados
-- ============================================================

-- Insertar riesgo 1
INSERT INTO risks (id, project_id, run_id, title, description, category, likelihood, impact, mitigation, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Competencia agresiva',
    'Las grandes plataformas podrían responder bajando precios o mejorando su oferta en ciudades pequeñas.',
    'competition',
    'high',
    'high',
    'Diferenciarse no solo por precio sino por servicio al cliente y marketing local.',
    'ai',
    'proposed'
);

-- Insertar riesgo 2
INSERT INTO risks (id, project_id, run_id, title, description, category, likelihood, impact, mitigation, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Baja adopción por parte de restaurantes',
    'Los restaurantes locales pueden ser reacios a cambiar de plataforma.',
    'operational',
    'medium',
    'high',
    'Ofrecer período de prueba sin comisiones y apoyo en la migración.',
    'ai',
    'proposed'
);

-- Insertar riesgo 3
INSERT INTO risks (id, project_id, run_id, title, description, category, likelihood, impact, mitigation, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Costos de logística',
    'La logística en ciudades pequeñas puede ser menos eficiente debido a la menor densidad de pedidos.',
    'financial',
    'medium',
    'medium',
    'Optimizar rutas con IA y consolidar pedidos en la misma zona.',
    'ai',
    'proposed'
);

-- Verificar los riesgos insertados
SELECT * FROM risks WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 13: Insertar hipótesis de validación
-- ============================================================

-- Insertar hipótesis 1
INSERT INTO validation_hypotheses (
    id, project_id, run_id, statement, related_attribute,
    validation_method, success_criteria, priority,
    validation_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Los restaurantes locales están dispuestos a probar una nueva plataforma con comisiones del 10%',
    'revenue_model',
    'Encuesta a 50 restaurantes locales en 3 ciudades pequeñas',
    'Al menos 60% de los restaurantes responden que están interesados',
    'high',
    'pending',
    'ai',
    'proposed'
);

-- Insertar hipótesis 2
INSERT INTO validation_hypotheses (
    id, project_id, run_id, statement, related_attribute,
    validation_method, success_criteria, priority,
    validation_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'Los consumidores están dispuestos a pagar un pequeño adicional por apoyar comercio local',
    'customer_segment',
    'Entrevistas a 100 consumidores y test A/B con precios',
    'Al menos 40% prefieren pagar 5% más por servicio local',
    'medium',
    'pending',
    'ai',
    'proposed'
);

-- Insertar hipótesis 3
INSERT INTO validation_hypotheses (
    id, project_id, run_id, statement, related_attribute,
    validation_method, success_criteria, priority,
    validation_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    'La logística en ciudades pequeñas puede ser rentable con al menos 50 pedidos por día',
    'solution',
    'Simulación de costos logísticos y prueba piloto en una ciudad',
    'Costo por pedido menor a $3 con 50 pedidos diarios',
    'high',
    'pending',
    'ai',
    'proposed'
);

-- Verificar las hipótesis insertadas
SELECT * FROM validation_hypotheses WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- PASO 14: Insertar información faltante
-- ============================================================

-- Insertar información faltante 1
INSERT INTO missing_information (
    id, project_id, run_id, question, reason, related_attribute,
    priority, resolution_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    '¿Cuál es el ticket promedio de pedidos en ciudades pequeñas?',
    'Necesario para calcular el ingreso potencial por restaurante',
    'revenue_model',
    'high',
    'open',
    'ai',
    'proposed'
);

-- Insertar información faltante 2
INSERT INTO missing_information (
    id, project_id, run_id, question, reason, related_attribute,
    priority, resolution_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    '¿Cuántos restaurantes hay en las ciudades objetivo?',
    'Necesario para estimar el tamaño del mercado potencial',
    'market',
    'high',
    'open',
    'ai',
    'proposed'
);

-- Insertar información faltante 3
INSERT INTO missing_information (
    id, project_id, run_id, question, reason, related_attribute,
    priority, resolution_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'UUID_DEL_RUN',
    '¿Qué canales de marketing son más efectivos en ciudades pequeñas?',
    'Necesario para definir la estrategia de adquisición de clientes',
    'channels',
    'medium',
    'open',
    'ai',
    'proposed'
);

-- Verificar la información faltante insertada
SELECT * FROM missing_information WHERE project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- RESUMEN FINAL: Vista completa del proyecto con todos los datos
-- ============================================================

-- Contar registros en cada tabla del proyecto
SELECT
    'Atributos de idea' as tipo, COUNT(*) as total FROM idea_attributes WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Consultas de investigación', COUNT(*) FROM research_queries WHERE run_id = 'UUID_DEL_RUN'
UNION ALL
SELECT 'Fuentes', COUNT(*) FROM sources WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Evidencia', COUNT(*) FROM evidence WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Hallazgos', COUNT(*) FROM findings WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Entidades', COUNT(*) FROM entities WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Competidores', COUNT(*) FROM competitors WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Oportunidades', COUNT(*) FROM opportunities WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Riesgos', COUNT(*) FROM risks WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Hipótesis de validación', COUNT(*) FROM validation_hypotheses WHERE project_id = 'UUID_DEL_PROYECTO'
UNION ALL
SELECT 'Información faltante', COUNT(*) FROM missing_information WHERE project_id = 'UUID_DEL_PROYECTO'
ORDER BY tipo;
