-- IdeaForge AI - Ejemplos de Consultas SQL
-- Base de datos PostgreSQL
-- Archivo para capturas de pantalla de consultas

-- ============================================================
-- a) Consulta de colecciones (tablas)
-- ============================================================

-- Listar todas las tablas de la base de datos
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Listar tablas con información adicional
SELECT
    table_name,
    table_type,
    is_insertable_into
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Contar registros en cada tabla principal
SELECT
    'users' as tabla, COUNT(*) as total FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'idea_attributes', COUNT(*) FROM idea_attributes
UNION ALL
SELECT 'research_runs', COUNT(*) FROM research_runs
UNION ALL
SELECT 'findings', COUNT(*) FROM findings
UNION ALL
SELECT 'competitors', COUNT(*) FROM competitors
UNION ALL
SELECT 'opportunities', COUNT(*) FROM opportunities
UNION ALL
SELECT 'risks', COUNT(*) FROM risks
ORDER BY tabla;

-- ============================================================
-- b) Consulta de datos específicos relacionados con el proyecto
-- ============================================================

-- Consultar un proyecto completo con sus atributos
SELECT
    p.id,
    p.title,
    p.raw_idea,
    p.status,
    p.created_at,
    p.updated_at,
    u.email as owner_email,
    u.full_name as owner_name
FROM projects p
JOIN users u ON p.user_id = u.id
WHERE p.id = 'UUID_DEL_PROYECTO'
LIMIT 1;

-- Consultar atributos de la idea de un proyecto
SELECT
    attribute_type,
    value,
    position,
    origin,
    is_confirmed,
    created_at
FROM idea_attributes
WHERE project_id = 'UUID_DEL_PROYECTO'
ORDER BY attribute_type, position;

-- Consultar investigación de un proyecto (última ejecución)
SELECT
    id,
    status,
    current_step,
    progress_pct,
    ai_provider,
    ai_model,
    error_code,
    started_at,
    finished_at
FROM research_runs
WHERE project_id = 'UUID_DEL_PROYECTO'
ORDER BY created_at DESC
LIMIT 1;

-- Consultar hallazgos de un proyecto
SELECT
    f.id,
    f.finding_type,
    f.statement,
    f.confidence_level,
    f.confidence_score,
    f.origin,
    f.review_status,
    f.created_at
FROM findings f
WHERE f.project_id = 'UUID_DEL_PROYECTO'
ORDER BY f.created_at DESC;

-- Consultar competidores de un proyecto con entidades
SELECT
    c.id,
    e.name as entity_name,
    e.website,
    c.competitor_type,
    c.threat_level,
    c.rationale,
    c.review_status
FROM competitors c
JOIN entities e ON c.entity_id = e.id
WHERE c.project_id = 'UUID_DEL_PROYECTO'
ORDER BY c.threat_level DESC, e.name;

-- Consultar oportunidades de un proyecto
SELECT
    id,
    title,
    description,
    potential,
    review_status,
    created_at
FROM opportunities
WHERE project_id = 'UUID_DEL_PROYECTO'
ORDER BY potential DESC, created_at DESC;

-- Consultar riesgos de un proyecto
SELECT
    id,
    title,
    description,
    category,
    likelihood,
    impact,
    mitigation,
    review_status
FROM risks
WHERE project_id = 'UUID_DEL_PROYECTO'
ORDER BY impact DESC, likelihood DESC;

-- Consultar análisis completo de un proyecto (resumen)
SELECT
    (SELECT COUNT(*) FROM opportunities WHERE project_id = p.id AND review_status = 'accepted') as opportunities_accepted,
    (SELECT COUNT(*) FROM risks WHERE project_id = p.id AND review_status = 'accepted') as risks_accepted,
    (SELECT COUNT(*) FROM validation_hypotheses WHERE project_id = p.id AND validation_status = 'pending') as hypotheses_pending,
    (SELECT COUNT(*) FROM missing_information WHERE project_id = p.id AND resolution_status = 'open') as missing_info_open
FROM projects p
WHERE p.id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- c) Consulta utilizando una condición (explicar la condición)
-- ============================================================

-- Condición: Proyectos en estado 'analyzed' (completados)
-- Explicación: Filtra solo proyectos que han completado el análisis
SELECT
    id,
    title,
    status,
    created_at,
    updated_at
FROM projects
WHERE status = 'analyzed'
ORDER BY updated_at DESC;

-- Condición: Hallazgos con alta confianza (confidence_level = 'high')
-- Explicación: Busca hallazgos que la IA clasificó como altamente confiables
SELECT
    f.id,
    f.finding_type,
    f.statement,
    f.confidence_level,
    f.confidence_score
FROM findings f
WHERE f.confidence_level = 'high'
AND f.project_id = 'UUID_DEL_PROYECTO'
ORDER BY f.confidence_score DESC NULLS LAST;

-- Condición: Competidores de alto riesgo (threat_level = 'high')
-- Explicación: Identifica competidores que representan una amenaza significativa
SELECT
    c.id,
    e.name,
    c.competitor_type,
    c.threat_level,
    c.rationale
FROM competitors c
JOIN entities e ON c.entity_id = e.id
WHERE c.project_id = 'UUID_DEL_PROYECTO'
AND c.threat_level = 'high'
AND c.review_status = 'accepted';

-- Condición: Riesgos con alto impacto Y alta probabilidad
-- Explicación: Identifica riesgos críticos que requieren atención inmediata
SELECT
    id,
    title,
    category,
    likelihood,
    impact,
    mitigation
FROM risks
WHERE project_id = 'UUID_DEL_PROYECTO'
AND likelihood = 'high'
AND impact = 'high'
AND review_status = 'accepted';

-- Condición: Evidencia de tipo 'cited_claim' (citas con grounding)
-- Explicación: Busca evidencia que tiene respaldo directo de fuentes
SELECT
    e.id,
    e.evidence_kind,
    e.content,
    s.domain,
    s.title
FROM evidence e
JOIN sources s ON e.source_id = s.id
WHERE e.project_id = 'UUID_DEL_PROYECTO'
AND e.evidence_kind = 'cited_claim'
ORDER BY e.created_at DESC;

-- Condición: Hipótesis pendientes de validación con alta prioridad
-- Explicación: Filtra hipótesis que aún no se han validado y son importantes
SELECT
    id,
    statement,
    related_attribute,
    priority,
    validation_status
FROM validation_hypotheses
WHERE project_id = 'UUID_DEL_PROYECTO'
AND validation_status = 'pending'
AND priority = 'high'
ORDER BY created_at DESC;

-- Condición: Proyectos actualizados en los últimos 7 días
-- Explicación: Busca proyectos con actividad reciente
SELECT
    p.id,
    p.title,
    p.status,
    p.updated_at,
    u.email
FROM projects p
JOIN users u ON p.user_id = u.id
WHERE p.updated_at >= NOW() - INTERVAL '7 days'
ORDER BY p.updated_at DESC;

-- Condición: Ejecuciones de investigación fallidas
-- Explicación: Identifica investigaciones que fallaron para revisión
SELECT
    r.id,
    r.project_id,
    p.title as project_title,
    r.status,
    r.error_code,
    r.error_message,
    r.created_at
FROM research_runs r
JOIN projects p ON r.project_id = p.id
WHERE r.status = 'failed'
ORDER BY r.created_at DESC;

-- ============================================================
-- d) Cambiar datos de una colección (UPDATE de una tabla)
-- ============================================================

-- Cambiar el estado de un proyecto
UPDATE projects
SET status = 'structured'
WHERE id = 'UUID_DEL_PROYECTO';

-- Cambiar el título de un proyecto
UPDATE projects
SET title = 'Nuevo título del proyecto',
    updated_at = NOW()
WHERE id = 'UUID_DEL_PROYECTO';

-- Cambiar el estado de revisión de un hallazgo
UPDATE findings
SET review_status = 'accepted',
    updated_at = NOW()
WHERE id = 'UUID_DEL_HALLAZGO'
AND project_id = 'UUID_DEL_PROYECTO';

-- Cambiar el nivel de amenaza de un competidor
UPDATE competitors
SET threat_level = 'high',
    rationale = 'Competidor dominante en el mercado',
    updated_at = NOW()
WHERE id = 'UUID_DEL_COMPETIDOR'
AND project_id = 'UUID_DEL_PROYECTO';

-- Cambiar el estado de validación de una hipótesis
UPDATE validation_hypotheses
SET validation_status = 'validated',
    result_notes = 'Validado mediante encuesta a clientes',
    updated_at = NOW()
WHERE id = 'UUID_DEL_HIPOTESIS'
AND project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- e) Agregar un campo (ALTER TABLE - ADD COLUMN)
-- ============================================================

-- NOTA: En PostgreSQL, agregar un campo requiere ALTER TABLE
-- Esto debe hacerse con cuidado en producción

-- Agregar campo de notas adicionales a projects
ALTER TABLE projects
ADD COLUMN notes TEXT;

-- Agregar campo de prioridad a projects
ALTER TABLE projects
ADD COLUMN priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high'));

-- Agregar campo de etiquetas a findings (JSONB para flexibilidad)
ALTER TABLE findings
ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;

-- Agregar campo de fuente manual a opportunities
ALTER TABLE opportunities
ADD COLUMN manual_source TEXT;

-- Agregar campo de fecha de revisión a risks
ALTER TABLE risks
ADD COLUMN reviewed_at TIMESTAMPTZ;

-- ============================================================
-- f) Agregar registros (INSERT)
-- ============================================================

-- Agregar un nuevo usuario
INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES (
    uuid_generate_v7(),
    'usuario@ejemplo.com',
    'hash_de_contraseña_aqui',
    'Usuario Ejemplo',
    'user',
    TRUE
);

-- Agregar un nuevo proyecto
INSERT INTO projects (id, user_id, title, raw_idea, status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_USUARIO',
    'Mi Idea de Negocio',
    'Una descripción detallada de mi idea de negocio que tiene al menos 20 caracteres...',
    'draft'
);

-- Agregar un atributo de idea
INSERT INTO idea_attributes (id, project_id, attribute_type, value, position, origin, is_confirmed)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'problem',
    'El problema que mi idea resuelve',
    0,
    'user',
    TRUE
);

-- Agregar una oportunidad manual
INSERT INTO opportunities (id, project_id, title, description, potential, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'Oportunidad en Mercado',
    'Descripción de la oportunidad identificada manualmente',
    'high',
    'user',
    'accepted'
);

-- Agregar un riesgo manual
INSERT INTO risks (id, project_id, title, description, category, likelihood, impact, mitigation, origin, review_status)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'Riesgo de Regulación',
    'Descripción del riesgo regulatorio',
    'regulatory',
    'medium',
    'high',
    'Estrategia de mitigación propuesta',
    'user',
    'accepted'
);

-- Agregar una hipótesis de validación
INSERT INTO validation_hypotheses (
    id, project_id, statement, related_attribute,
    validation_method, success_criteria, priority,
    validation_status, origin, review_status
)
VALUES (
    uuid_generate_v7(),
    'UUID_DEL_PROYECTO',
    'Los clientes están dispuestos a pagar $50 por el servicio',
    'revenue_model',
    'Encuesta a 100 clientes potenciales',
    'Al menos 70% responden afirmativamente',
    'high',
    'pending',
    'user',
    'proposed'
);

-- ============================================================
-- g) Actualización de un documento (UPDATE con WHERE específico)
-- ============================================================

-- Actualizar un proyecto específico
UPDATE projects
SET title = 'Título Actualizado',
    raw_idea = 'Descripción actualizada de la idea',
    status = 'structured',
    updated_at = NOW()
WHERE id = 'UUID_ESPECIFICO';

-- Actualizar un hallazgo específico
UPDATE findings
SET statement = 'Enunciado corregido del hallazgo',
    confidence_level = 'high',
    confidence_score = 0.85,
    review_status = 'accepted',
    updated_at = NOW()
WHERE id = 'UUID_DEL_HALLAZGO';

-- Actualizar una oportunidad específica
UPDATE opportunities
SET title = 'Oportunidad actualizada',
    description = 'Descripción más detallada',
    potential = 'high',
    review_status = 'accepted',
    updated_at = NOW()
WHERE id = 'UUID_DE_OPORTUNIDAD';

-- Actualizar un riesgo específico
UPDATE risks
SET title = 'Riesgo actualizado',
    mitigation = 'Plan de mitigación revisado y mejorado',
    likelihood = 'low',
    review_status = 'accepted',
    updated_at = NOW()
WHERE id = 'UUID_DEL_RIESGO';

-- ============================================================
-- h) Actualización de varios documentos (UPDATE con condición múltiple)
-- ============================================================

-- Actualizar todos los hallazgos pendientes de un proyecto a aceptados
UPDATE findings
SET review_status = 'accepted',
    updated_at = NOW()
WHERE project_id = 'UUID_DEL_PROYECTO'
AND review_status = 'proposed'
AND origin = 'ai';

-- Actualizar todos los riesgos de categoría 'market' a likelihood 'medium'
UPDATE risks
SET likelihood = 'medium',
    updated_at = NOW()
WHERE project_id = 'UUID_DEL_PROYECTO'
AND category = 'market'
AND likelihood = 'undetermined';

-- Actualizar todas las hipótesis pendientes a 'in_progress'
UPDATE validation_hypotheses
SET validation_status = 'in_progress',
    updated_at = NOW()
WHERE project_id = 'UUID_DEL_PROYECTO'
AND validation_status = 'pending'
AND priority = 'high';

-- Actualizar información faltante resuelta
UPDATE missing_information
SET resolution_status = 'resolved',
    resolution_notes = 'Información obtenida mediante investigación adicional',
    updated_at = NOW()
WHERE project_id = 'UUID_DEL_PROYECTO'
AND resolution_status = 'open'
AND priority = 'low';

-- Actualizar atributos de idea no confirmados
UPDATE idea_attributes
SET is_confirmed = TRUE,
    updated_at = NOW()
WHERE project_id = 'UUID_DEL_PROYECTO'
AND origin = 'ai'
AND is_confirmed = FALSE;

-- ============================================================
-- i) Eliminación de un documento (DELETE con WHERE específico)
-- ============================================================

-- Eliminar un proyecto específico (CASCADE borra datos relacionados)
DELETE FROM projects
WHERE id = 'UUID_ESPECIFICO';

-- Eliminar un hallazgo específico
DELETE FROM findings
WHERE id = 'UUID_DEL_HALLAZGO'
AND project_id = 'UUID_DEL_PROYECTO';

-- Eliminar una oportunidad específica
DELETE FROM opportunities
WHERE id = 'UUID_DE_OPORTUNIDAD'
AND project_id = 'UUID_DEL_PROYECTO';

-- Eliminar un riesgo específico
DELETE FROM risks
WHERE id = 'UUID_DEL_RIESGO'
AND project_id = 'UUID_DEL_PROYECTO';

-- Eliminar una hipótesis específica
DELETE FROM validation_hypotheses
WHERE id = 'UUID_DEL_HIPOTESIS'
AND project_id = 'UUID_DEL_PROYECTO';

-- Eliminar información faltante específica
DELETE FROM missing_information
WHERE id = 'UUID_DE_INFO_FALTANTE'
AND project_id = 'UUID_DEL_PROYECTO';

-- ============================================================
-- j) Eliminación de varios documentos (DELETE con condición múltiple)
-- ============================================================

-- Eliminar todos los hallazgos rechazados de un proyecto
DELETE FROM findings
WHERE project_id = 'UUID_DEL_PROYECTO'
AND review_status = 'rejected';

-- Eliminar todas las oportunidades con review_status 'proposed'
DELETE FROM opportunities
WHERE project_id = 'UUID_DEL_PROYECTO'
AND review_status = 'proposed'
AND origin = 'ai';

-- Eliminar todos los riesgos de baja prioridad aceptados
DELETE FROM risks
WHERE project_id = 'UUID_DEL_PROYECTO'
AND priority = 'low'
AND review_status = 'accepted';

-- Eliminar información faltante resuelta
DELETE FROM missing_information
WHERE project_id = 'UUID_DEL_PROYECTO'
AND resolution_status = 'resolved';

-- Eliminar ejecuciones de investigación fallidas antiguas (más de 30 días)
DELETE FROM research_runs
WHERE project_id = 'UUID_DEL_PROYECTO'
AND status = 'failed'
AND created_at < NOW() - INTERVAL '30 days';

-- Eliminar competidores rechazados
DELETE FROM competitors
WHERE project_id = 'UUID_DEL_PROYECTO'
AND review_status = 'rejected';

-- ============================================================
-- Consultas adicionales útiles para capturas
-- ============================================================

-- JOIN complejo: Proyecto con todo su análisis
SELECT
    p.id as project_id,
    p.title,
    p.status,
    COUNT(DISTINCT f.id) as total_findings,
    COUNT(DISTINCT c.id) as total_competitors,
    COUNT(DISTINCT o.id) as total_opportunities,
    COUNT(DISTINCT r.id) as total_risks,
    COUNT(DISTINCT h.id) as total_hypotheses,
    COUNT(DISTINCT m.id) as total_missing_info
FROM projects p
LEFT JOIN findings f ON p.id = f.project_id
LEFT JOIN competitors c ON p.id = c.project_id
LEFT JOIN opportunities o ON p.id = o.project_id
LEFT JOIN risks r ON p.id = r.project_id
LEFT JOIN validation_hypotheses h ON p.id = h.project_id
LEFT JOIN missing_information m ON p.id = m.project_id
WHERE p.id = 'UUID_DEL_PROYECTO'
GROUP BY p.id, p.title, p.status;

-- Consulta con agregación: Estadísticas por usuario
SELECT
    u.email,
    u.full_name,
    COUNT(DISTINCT p.id) as total_projects,
    COUNT(DISTINCT CASE WHEN p.status = 'analyzed' THEN p.id END) as completed_projects,
    COUNT(DISTINCT rr.id) as total_research_runs,
    COUNT(DISTINCT CASE WHEN rr.status = 'completed' THEN rr.id END) as completed_runs
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN research_runs rr ON p.id = rr.project_id
GROUP BY u.id, u.email, u.full_name
ORDER BY total_projects DESC;

-- Consulta con ventana: Hallazgos recientes por tipo
SELECT
    finding_type,
    statement,
    confidence_level,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY finding_type ORDER BY created_at DESC) as rn
FROM findings
WHERE project_id = 'UUID_DEL_PROYECTO'
ORDER BY finding_type, created_at DESC;
