-- IdeaForge AI - Base de datos PostgreSQL
-- Generado a partir de los modelos SQLAlchemy del proyecto
-- Versión: PostgreSQL 18+
-- Encoding: UTF-8

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enumeraciones (implementadas como VARCHAR + CHECK)
-- Estos valores se guardan en inglés; el frontend los traduce a español

-- users.role
-- CHECK constraint en la tabla users

-- projects.status
-- CHECK constraint en la tabla projects

-- idea_attributes.attribute_type
-- CHECK constraint en la tabla idea_attributes

-- research_runs.status
-- CHECK constraint en la tabla research_runs

-- research_runs.current_step
-- CHECK constraint en la tabla research_runs

-- research_queries.status
-- CHECK constraint en la tabla research_queries

-- research_queries.category
-- CHECK constraint en la tabla research_queries

-- sources.source_type
-- CHECK constraint en la tabla sources

-- evidence.evidence_kind
-- CHECK constraint en la tabla evidence

-- evidence.stance
-- CHECK constraint en la tabla finding_evidence

-- findings.finding_type
-- CHECK constraint en la tabla findings

-- findings.confidence_level
-- CHECK constraint en la tabla findings

-- entities.entity_type
-- CHECK constraint en la tabla entities

-- competitors.competitor_type
-- CHECK constraint en la tabla competitors

-- competitors.threat_level
-- CHECK constraint en la tabla competitors

-- analysis.risks.category
-- CHECK constraint en la tabla risks

-- analysis.risks.likelihood
-- CHECK constraint en la tabla risks

-- analysis.risks.impact
-- CHECK constraint en la tabla risks

-- analysis.opportunities.potential
-- CHECK constraint en la tabla opportunities

-- analysis.validation_hypotheses.validation_status
-- CHECK constraint en la tabla validation_hypotheses

-- analysis.validation_hypotheses.priority
-- CHECK constraint en la tabla validation_hypotheses

-- analysis.missing_information.resolution_status
-- CHECK constraint en la tabla missing_information

-- analysis.missing_information.priority
-- CHECK constraint en la tabla missing_information

-- reports.status
-- CHECK constraint en la tabla reports

-- reports.section_type
-- CHECK constraint en la tabla report_sections

-- ai_api_logs.provider
-- CHECK constraint en la tabla ai_api_logs
-- NOTA: Según PROMPT_MAESTRO actualizado, GROK debería cambiarse a OLLAMA en Fase 12

-- ai_api_logs.operation
-- CHECK constraint en la tabla ai_api_logs

-- ai_api_logs.status
-- CHECK constraint en la tabla ai_api_logs

-- Tablas principales

-- Tabla: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email CITEXT NOT NULL UNIQUE,
    password_hash VARCHAR NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    CONSTRAINT email_length CHECK (char_length(email) <= 254),
    CONSTRAINT full_name_not_blank CHECK (btrim(full_name) <> '')
);

-- Trigger para updated_at en users
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: refresh_tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    CONSTRAINT expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Tabla: projects
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    raw_idea TEXT NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'structured', 'researching', 'analyzed')),
    CONSTRAINT title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT raw_idea_length CHECK (char_length(raw_idea) BETWEEN 20 AND 5000)
);

CREATE INDEX ix_projects_user_id_updated_at ON projects(user_id, updated_at DESC);

-- Trigger para updated_at en projects
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: idea_attributes
CREATE TABLE idea_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    attribute_type VARCHAR(30) NOT NULL CHECK (attribute_type IN (
        'problem', 'solution', 'customer_segment', 'product_service',
        'channels', 'revenue_model', 'geographic_scope', 'differentiators', 'technologies'
    )),
    value TEXT NOT NULL,
    position SMALLINT NOT NULL DEFAULT 0,
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT value_length CHECK (char_length(value) BETWEEN 1 AND 4000),
    CONSTRAINT position_non_negative CHECK (position >= 0),
    UNIQUE (project_id, attribute_type, position)
);

-- Trigger para updated_at en idea_attributes
CREATE TRIGGER set_idea_attributes_updated_at
    BEFORE UPDATE ON idea_attributes
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: research_runs
CREATE TABLE research_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'interrupted')),
    current_step VARCHAR(15) CHECK (current_step IN ('planning', 'searching', 'extracting', 'analyzing', 'scoring')),
    progress_pct SMALLINT NOT NULL DEFAULT 0,
    ai_provider VARCHAR(10) NOT NULL CHECK (ai_provider IN ('gemini', 'ollama', 'fake', 'legacy')),
    ai_model VARCHAR(100) NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    CONSTRAINT progress_range CHECK (progress_pct BETWEEN 0 AND 100),
    CONSTRAINT dates_order CHECK (
        finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at
    ),
    UNIQUE (id, project_id)
);

CREATE INDEX ix_research_runs_project_id_created_at ON research_runs(project_id, created_at DESC);
CREATE UNIQUE INDEX uq_research_runs_one_active ON research_runs(project_id)
    WHERE status IN ('pending', 'running');

-- Trigger para updated_at en research_runs
CREATE TRIGGER set_research_runs_updated_at
    BEFORE UPDATE ON research_runs
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: research_queries
CREATE TABLE research_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
    position SMALLINT NOT NULL,
    category VARCHAR(15) NOT NULL CHECK (category IN (
        'market', 'customers', 'competition', 'substitutes',
        'technology', 'regulation', 'pricing', 'other'
    )),
    question TEXT NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    response_text TEXT,
    executed_queries JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_suggestions_html TEXT,
    completed_at TIMESTAMPTZ,
    CONSTRAINT executed_queries_array CHECK (jsonb_typeof(executed_queries) = 'array'),
    UNIQUE (run_id, position)
);

-- Tabla: sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    canonical_url TEXT NOT NULL,
    domain VARCHAR(255) NOT NULL,
    title TEXT,
    source_type VARCHAR(15) NOT NULL DEFAULT 'unknown' CHECK (source_type IN (
        'news', 'company_site', 'government', 'academic', 'marketplace',
        'social', 'blog', 'review_site', 'other', 'unknown'
    )),
    published_at TIMESTAMPTZ,
    UNIQUE (project_id, canonical_url),
    UNIQUE (id, project_id)
);

CREATE INDEX ix_sources_project_id_domain ON sources(project_id, domain);

-- Tabla: research_query_sources
CREATE TABLE research_query_sources (
    query_id UUID NOT NULL REFERENCES research_queries(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    was_cited BOOLEAN NOT NULL,
    rank SMALLINT,
    PRIMARY KEY (query_id, source_id)
);

CREATE INDEX ix_research_query_sources_source_id ON research_query_sources(source_id);

-- Tabla: evidence
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_id UUID NOT NULL,
    query_id UUID REFERENCES research_queries(id) ON DELETE CASCADE,
    evidence_kind VARCHAR(20) NOT NULL CHECK (evidence_kind IN ('cited_claim', 'source_excerpt')),
    content TEXT NOT NULL,
    span_start INTEGER,
    span_end INTEGER,
    CONSTRAINT span_valid CHECK (
        (span_start IS NULL AND span_end IS NULL)
        OR (span_start >= 0 AND span_end > span_start)
    ),
    CONSTRAINT cited_claim_requires_span CHECK (
        evidence_kind <> 'cited_claim' OR (query_id IS NOT NULL AND span_start IS NOT NULL)
    ),
    FOREIGN KEY (source_id, project_id) REFERENCES sources(id, project_id) ON DELETE CASCADE
);

CREATE INDEX ix_evidence_project_id ON evidence(project_id);
CREATE INDEX ix_evidence_source_id ON evidence(source_id);
CREATE INDEX ix_evidence_query_id ON evidence(query_id);

-- Tabla: findings
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID,
    finding_type VARCHAR(15) NOT NULL CHECK (finding_type IN (
        'market', 'customers', 'competition', 'substitutes',
        'technology', 'regulation', 'pricing', 'other'
    )),
    statement TEXT NOT NULL,
    confidence_level VARCHAR(15) NOT NULL DEFAULT 'undetermined' CHECK (confidence_level IN (
        'low', 'medium', 'high', 'undetermined'
    )),
    confidence_score NUMERIC(3, 2),
    confidence_rationale TEXT,
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    review_status VARCHAR(15) NOT NULL DEFAULT 'proposed' CHECK (review_status IN (
        'proposed', 'accepted', 'rejected'
    )),
    CONSTRAINT confidence_score_range CHECK (confidence_score BETWEEN 0 AND 1),
    CONSTRAINT ai_requires_run CHECK (origin = 'user' OR run_id IS NOT NULL),
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE CASCADE
);

CREATE INDEX ix_findings_project_id_finding_type ON findings(project_id, finding_type);
CREATE INDEX ix_findings_run_id ON findings(run_id);

-- Trigger para updated_at en findings
CREATE TRIGGER set_findings_updated_at
    BEFORE UPDATE ON findings
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: finding_evidence
CREATE TABLE finding_evidence (
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    stance VARCHAR(15) NOT NULL CHECK (stance IN ('supports', 'contradicts', 'context')),
    PRIMARY KEY (finding_id, evidence_id)
);

CREATE INDEX ix_finding_evidence_evidence_id ON finding_evidence(evidence_id);

-- Tabla: entities
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(15) NOT NULL CHECK (entity_type IN (
        'company', 'product', 'technology', 'organization', 'other'
    )),
    name VARCHAR(200) NOT NULL,
    normalized_name VARCHAR(200) NOT NULL,
    website TEXT,
    description TEXT,
    UNIQUE (project_id, entity_type, normalized_name),
    UNIQUE (id, project_id)
);

CREATE INDEX ix_entities_normalized_name_trgm ON entities USING gin (normalized_name gin_trgm_ops);

-- Trigger para updated_at en entities
CREATE TRIGGER set_entities_updated_at
    BEFORE UPDATE ON entities
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: entity_aliases
CREATE TABLE entity_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    alias VARCHAR(200) NOT NULL,
    normalized_alias VARCHAR(200) NOT NULL,
    UNIQUE (entity_id, normalized_alias)
);

CREATE INDEX ix_entity_aliases_normalized_alias_trgm ON entity_aliases USING gin (normalized_alias gin_trgm_ops);

-- Tabla: competitors
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL,
    run_id UUID,
    competitor_type VARCHAR(15) NOT NULL CHECK (competitor_type IN (
        'direct', 'indirect', 'substitute', 'alternative'
    )),
    rationale TEXT,
    threat_level VARCHAR(15) NOT NULL DEFAULT 'undetermined' CHECK (threat_level IN (
        'low', 'medium', 'high', 'undetermined'
    )),
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    review_status VARCHAR(15) NOT NULL DEFAULT 'proposed' CHECK (review_status IN (
        'proposed', 'accepted', 'rejected'
    )),
    UNIQUE (project_id, entity_id),
    FOREIGN KEY (entity_id, project_id) REFERENCES entities(id, project_id) ON DELETE CASCADE,
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE SET NULL
);

-- Trigger para updated_at en competitors
CREATE TRIGGER set_competitors_updated_at
    BEFORE UPDATE ON competitors
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: opportunities
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    potential VARCHAR(15) NOT NULL DEFAULT 'undetermined' CHECK (potential IN (
        'low', 'medium', 'high', 'undetermined'
    )),
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    review_status VARCHAR(15) NOT NULL DEFAULT 'proposed' CHECK (review_status IN (
        'proposed', 'accepted', 'rejected'
    )),
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE SET NULL
);

CREATE INDEX ix_opportunities_project_id ON opportunities(project_id);

-- Trigger para updated_at en opportunities
CREATE TRIGGER set_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: risks
CREATE TABLE risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(15) NOT NULL CHECK (category IN (
        'market', 'competition', 'technical', 'regulatory', 'financial', 'operational', 'other'
    )),
    likelihood VARCHAR(15) NOT NULL DEFAULT 'undetermined' CHECK (likelihood IN (
        'low', 'medium', 'high', 'undetermined'
    )),
    impact VARCHAR(15) NOT NULL DEFAULT 'undetermined' CHECK (impact IN (
        'low', 'medium', 'high', 'undetermined'
    )),
    mitigation TEXT,
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    review_status VARCHAR(15) NOT NULL DEFAULT 'proposed' CHECK (review_status IN (
        'proposed', 'accepted', 'rejected'
    )),
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE SET NULL
);

CREATE INDEX ix_risks_project_id ON risks(project_id);

-- Trigger para updated_at en risks
CREATE TRIGGER set_risks_updated_at
    BEFORE UPDATE ON risks
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: validation_hypotheses
CREATE TABLE validation_hypotheses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID,
    statement TEXT NOT NULL,
    related_attribute VARCHAR(30) CHECK (related_attribute IN (
        'problem', 'solution', 'customer_segment', 'product_service',
        'channels', 'revenue_model', 'geographic_scope', 'differentiators', 'technologies'
    )),
    validation_method TEXT,
    success_criteria TEXT,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    validation_status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (validation_status IN (
        'pending', 'in_progress', 'validated', 'invalidated', 'inconclusive'
    )),
    result_notes TEXT,
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    review_status VARCHAR(15) NOT NULL DEFAULT 'proposed' CHECK (review_status IN (
        'proposed', 'accepted', 'rejected'
    )),
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE SET NULL
);

CREATE INDEX ix_validation_hypotheses_project_id ON validation_hypotheses(project_id);

-- Trigger para updated_at en validation_hypotheses
CREATE TRIGGER set_validation_hypotheses_updated_at
    BEFORE UPDATE ON validation_hypotheses
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: missing_information
CREATE TABLE missing_information (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID,
    question TEXT NOT NULL,
    reason TEXT,
    related_attribute VARCHAR(30) CHECK (related_attribute IN (
        'problem', 'solution', 'customer_segment', 'product_service',
        'channels', 'revenue_model', 'geographic_scope', 'differentiators', 'technologies'
    )),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    resolution_status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (resolution_status IN (
        'open', 'resolved', 'dismissed'
    )),
    resolution_notes TEXT,
    origin VARCHAR(10) NOT NULL CHECK (origin IN ('ai', 'user')),
    review_status VARCHAR(15) NOT NULL DEFAULT 'proposed' CHECK (review_status IN (
        'proposed', 'accepted', 'rejected'
    )),
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE SET NULL
);

CREATE INDEX ix_missing_information_project_id ON missing_information(project_id);

-- Trigger para updated_at en missing_information
CREATE TRIGGER set_missing_information_updated_at
    BEFORE UPDATE ON missing_information
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Tabla: opportunity_findings
CREATE TABLE opportunity_findings (
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    PRIMARY KEY (opportunity_id, finding_id)
);

CREATE INDEX ix_opportunity_findings_finding_id ON opportunity_findings(finding_id);

-- Tabla: risk_findings
CREATE TABLE risk_findings (
    risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    PRIMARY KEY (risk_id, finding_id)
);

CREATE INDEX ix_risk_findings_finding_id ON risk_findings(finding_id);

-- Tabla: hypothesis_findings
CREATE TABLE hypothesis_findings (
    hypothesis_id UUID NOT NULL REFERENCES validation_hypotheses(id) ON DELETE CASCADE,
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    PRIMARY KEY (hypothesis_id, finding_id)
);

CREATE INDEX ix_hypothesis_findings_finding_id ON hypothesis_findings(finding_id);

-- Tabla: finding_entities
CREATE TABLE finding_entities (
    finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    PRIMARY KEY (finding_id, entity_id)
);

CREATE INDEX ix_finding_entities_entity_id ON finding_entities(entity_id);

-- Tabla: reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID,
    version INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
    ai_provider VARCHAR(10) NOT NULL CHECK (ai_provider IN ('gemini', 'ollama', 'fake', 'legacy')),
    ai_model VARCHAR(100) NOT NULL,
    error_code VARCHAR(50),
    completed_at TIMESTAMPTZ,
    CONSTRAINT version_positive CHECK (version > 0),
    UNIQUE (project_id, version),
    FOREIGN KEY (run_id, project_id) REFERENCES research_runs(id, project_id) ON DELETE SET NULL
);

-- Tabla: report_sections
CREATE TABLE report_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    section_type VARCHAR(30) NOT NULL CHECK (section_type IN (
        'executive_summary', 'idea_overview', 'market', 'competition',
        'opportunities', 'risks', 'hypotheses', 'missing_information',
        'sources', 'conclusions'
    )),
    position SMALLINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    UNIQUE (report_id, position),
    UNIQUE (report_id, section_type)
);

-- Tabla: ai_api_logs
CREATE TABLE ai_api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    research_run_id UUID REFERENCES research_runs(id) ON DELETE SET NULL,
    provider VARCHAR(10) NOT NULL CHECK (provider IN ('gemini', 'ollama', 'fake', 'legacy')),
    model VARCHAR(100) NOT NULL,
    operation VARCHAR(30) NOT NULL CHECK (operation IN (
        'idea_structuring', 'research_planning', 'grounded_search',
        'extraction', 'analysis', 'report_generation', 'chat'
    )),
    prompt_version VARCHAR(50),
    status VARCHAR(10) NOT NULL CHECK (status IN ('success', 'error')),
    error_code VARCHAR(50),
    input_tokens INTEGER,
    output_tokens INTEGER,
    search_queries_count INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    estimated_cost_usd NUMERIC(12, 8),
    CONSTRAINT non_negative_metrics CHECK (
        coalesce(input_tokens, 0) >= 0
        AND coalesce(output_tokens, 0) >= 0
        AND search_queries_count >= 0
        AND coalesce(latency_ms, 0) >= 0
        AND coalesce(estimated_cost_usd, 0) >= 0
    )
);

CREATE INDEX ix_ai_api_logs_user_id_created_at ON ai_api_logs(user_id, created_at DESC);
CREATE INDEX ix_ai_api_logs_project_id ON ai_api_logs(project_id);
CREATE INDEX ix_ai_api_logs_research_run_id ON ai_api_logs(research_run_id);
CREATE INDEX ix_ai_api_logs_created_at ON ai_api_logs(created_at);

-- Función auxiliar para trigger de updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentarios
COMMENT ON TABLE users IS 'Usuarios del sistema';
COMMENT ON TABLE refresh_tokens IS 'Tokens de refresh para autenticación JWT';
COMMENT ON TABLE projects IS 'Proyectos de ideas de negocio';
COMMENT ON TABLE idea_attributes IS 'Atributos estructurados de la idea (problema, solución, etc.)';
COMMENT ON TABLE research_runs IS 'Ejecuciones de investigación (runs)';
COMMENT ON TABLE research_queries IS 'Consultas de investigación realizadas';
COMMENT ON TABLE sources IS 'Fuentes de información (sitios web, artículos, etc.)';
COMMENT ON TABLE research_query_sources IS 'Relación entre consultas y fuentes';
COMMENT ON TABLE evidence IS 'Evidencia encontrada (fragmentos, citas, etc.)';
COMMENT ON TABLE findings IS 'Hallazgos de investigación';
COMMENT ON TABLE finding_evidence IS 'Relación entre hallazgos y evidencia';
COMMENT ON TABLE finding_entities IS 'Relación entre hallazgos y entidades';
COMMENT ON TABLE entities IS 'Entidades identificadas (empresas, productos, etc.)';
COMMENT ON TABLE entity_aliases IS 'Alias de entidades para deduplicación';
COMMENT ON TABLE competitors IS 'Competidores identificados';
COMMENT ON TABLE opportunities IS 'Oportunidades de negocio identificadas';
COMMENT ON TABLE risks IS 'Riesgos identificados';
COMMENT ON TABLE validation_hypotheses IS 'Hipótesis que requieren validación';
COMMENT ON TABLE missing_information IS 'Información que falta para completar el análisis';
COMMENT ON TABLE opportunity_findings IS 'Relación entre oportunidades y hallazgos';
COMMENT ON TABLE risk_findings IS 'Relación entre riesgos y hallazgos';
COMMENT ON TABLE hypothesis_findings IS 'Relación entre hipótesis y hallazgos';
COMMENT ON TABLE reports IS 'Reportes generados del análisis';
COMMENT ON TABLE report_sections IS 'Secciones de los reportes';
COMMENT ON TABLE ai_api_logs IS 'Auditoría de llamadas a APIs de IA (sin prompts ni keys)';

-- AIProviderName incluye gemini, ollama, fake y legacy (solo para proveedores históricos).
-- La migración de Fase 12 conserva registros antiguos bajo legacy y agrega costo nullable a ai_api_logs.
-- Gemini solo registra costos cuando exista una estimación fiable; Ollama registra costo cero.
