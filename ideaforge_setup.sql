-- =====================================================================
-- IdeaForge AI - Script de creación de base de datos
--
-- Crea:
--   1. El usuario de la aplicación "ideaforge" (sin permisos de superusuario).
--   2. Las bases "ideaforge_dev" (desarrollo) e "ideaforge_test" (pruebas),
--      propiedad de "ideaforge".
--   3. La estructura completa de tablas, índices, restricciones y triggers, sin datos.
--   4. El registro de versión de Alembic, para no volver a crear tablas.
--
-- Cómo ejecutarlo (PowerShell, en la carpeta donde está este archivo):
--   psql -U postgres -f ideaforge_setup.sql
--
-- ANTES de ejecutar:
--   - Cambia CAMBIAR_ESTA_CONTRASENA por una contraseña propia (paso 1).
--   - Tu contraseña de la aplicación debe coincidir con DATABASE_URL en backend/.env.
--
-- Si el script ya se ejecutó antes, fallará en CREATE DATABASE porque las bases existen.
-- No se borra nada automáticamente.
-- =====================================================================
\set ON_ERROR_STOP on

-- 1. Usuario de la aplicación
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ideaforge') THEN
        CREATE ROLE ideaforge LOGIN PASSWORD 'CAMBIAR_ESTA_CONTRASENA';
    END IF;
END
$$;

-- 2. Bases de datos y privilegios
CREATE DATABASE ideaforge_dev OWNER ideaforge;
CREATE DATABASE ideaforge_test OWNER ideaforge;
GRANT ALL PRIVILEGES ON DATABASE ideaforge_dev TO ideaforge;
GRANT ALL PRIVILEGES ON DATABASE ideaforge_test TO ideaforge;

-- 3. Estructura de la base de desarrollo.
-- SET ROLE hace que todas las tablas pertenezcan al usuario ideaforge.
\c ideaforge_dev
SET ROLE ideaforge;

--
-- PostgreSQL database dump
--

\restrict J8st9MDuilOgt4fK8sAVclBqzXqHg25bgZbdBJwheFT7xadDSnbEZt4kOXFc5la

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END
        $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_api_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_api_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid,
    project_id uuid,
    research_run_id uuid,
    provider character varying(20) NOT NULL,
    model character varying(100) NOT NULL,
    operation character varying(30) NOT NULL,
    prompt_version character varying(50),
    status character varying(10) NOT NULL,
    error_code character varying(50),
    input_tokens integer,
    output_tokens integer,
    search_queries_count integer DEFAULT 0 NOT NULL,
    latency_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    estimated_cost_usd numeric(12,8),
    CONSTRAINT ck_ai_api_logs_non_negative_metrics CHECK (((COALESCE(input_tokens, 0) >= 0) AND (COALESCE(output_tokens, 0) >= 0) AND (search_queries_count >= 0) AND (COALESCE(latency_ms, 0) >= 0) AND (COALESCE(estimated_cost_usd, (0)::numeric) >= (0)::numeric))),
    CONSTRAINT ck_ai_api_logs_operation CHECK (((operation)::text = ANY ((ARRAY['idea_structuring'::character varying, 'research_planning'::character varying, 'grounded_search'::character varying, 'extraction'::character varying, 'analysis'::character varying, 'report_generation'::character varying, 'chat'::character varying])::text[]))),
    CONSTRAINT ck_ai_api_logs_provider CHECK (((provider)::text = ANY ((ARRAY['engine'::character varying, 'fake'::character varying, 'legacy'::character varying])::text[]))),
    CONSTRAINT ck_ai_api_logs_status CHECK (((status)::text = ANY ((ARRAY['success'::character varying, 'error'::character varying])::text[])))
);


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    run_id uuid,
    competitor_type character varying(15) NOT NULL,
    rationale text,
    threat_level character varying(15) DEFAULT 'undetermined'::character varying NOT NULL,
    origin character varying(10) NOT NULL,
    review_status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_competitors_competitor_type CHECK (((competitor_type)::text = ANY ((ARRAY['direct'::character varying, 'indirect'::character varying, 'substitute'::character varying, 'alternative'::character varying])::text[]))),
    CONSTRAINT ck_competitors_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_competitors_review_status CHECK (((review_status)::text = ANY ((ARRAY['proposed'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT ck_competitors_threat_level CHECK (((threat_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'undetermined'::character varying])::text[])))
);


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entities (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    entity_type character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    normalized_name character varying(200) NOT NULL,
    website text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_entities_entity_type CHECK (((entity_type)::text = ANY ((ARRAY['company'::character varying, 'product'::character varying, 'technology'::character varying, 'organization'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: entity_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_aliases (
    id uuid DEFAULT uuidv7() NOT NULL,
    entity_id uuid NOT NULL,
    alias character varying(200) NOT NULL,
    normalized_alias character varying(200) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evidence (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    source_id uuid NOT NULL,
    query_id uuid,
    evidence_kind character varying(20) NOT NULL,
    content text NOT NULL,
    span_start integer,
    span_end integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_evidence_cited_claim_requires_span CHECK ((((evidence_kind)::text <> 'cited_claim'::text) OR ((query_id IS NOT NULL) AND (span_start IS NOT NULL)))),
    CONSTRAINT ck_evidence_evidence_kind CHECK (((evidence_kind)::text = ANY ((ARRAY['cited_claim'::character varying, 'source_excerpt'::character varying])::text[]))),
    CONSTRAINT ck_evidence_span_valid CHECK ((((span_start IS NULL) AND (span_end IS NULL)) OR ((span_start >= 0) AND (span_end > span_start))))
);


--
-- Name: finding_entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finding_entities (
    finding_id uuid NOT NULL,
    entity_id uuid NOT NULL
);


--
-- Name: finding_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finding_evidence (
    finding_id uuid NOT NULL,
    evidence_id uuid NOT NULL,
    stance character varying(15) NOT NULL,
    CONSTRAINT ck_finding_evidence_stance CHECK (((stance)::text = ANY ((ARRAY['supports'::character varying, 'contradicts'::character varying, 'context'::character varying])::text[])))
);


--
-- Name: findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.findings (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    run_id uuid,
    finding_type character varying(20) NOT NULL,
    statement text NOT NULL,
    confidence_level character varying(15) DEFAULT 'undetermined'::character varying NOT NULL,
    confidence_score numeric(3,2),
    confidence_rationale text,
    origin character varying(10) NOT NULL,
    review_status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_findings_ai_requires_run CHECK ((((origin)::text = 'user'::text) OR (run_id IS NOT NULL))),
    CONSTRAINT ck_findings_confidence_level CHECK (((confidence_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'undetermined'::character varying])::text[]))),
    CONSTRAINT ck_findings_confidence_score_range CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric))),
    CONSTRAINT ck_findings_finding_type CHECK (((finding_type)::text = ANY ((ARRAY['market'::character varying, 'customers'::character varying, 'competition'::character varying, 'substitutes'::character varying, 'technology'::character varying, 'regulation'::character varying, 'pricing'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ck_findings_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_findings_review_status CHECK (((review_status)::text = ANY ((ARRAY['proposed'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: hypothesis_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hypothesis_findings (
    hypothesis_id uuid NOT NULL,
    finding_id uuid NOT NULL
);


--
-- Name: idea_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idea_attributes (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    attribute_type character varying(30) NOT NULL,
    value text NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    origin character varying(10) NOT NULL,
    is_confirmed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_idea_attributes_attribute_type CHECK (((attribute_type)::text = ANY ((ARRAY['problem'::character varying, 'solution'::character varying, 'customer_segment'::character varying, 'product_service'::character varying, 'channels'::character varying, 'revenue_model'::character varying, 'geographic_scope'::character varying, 'differentiators'::character varying, 'technologies'::character varying])::text[]))),
    CONSTRAINT ck_idea_attributes_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_idea_attributes_position_non_negative CHECK (("position" >= 0)),
    CONSTRAINT ck_idea_attributes_value_length CHECK (((char_length(value) >= 1) AND (char_length(value) <= 4000)))
);


--
-- Name: missing_information; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missing_information (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    run_id uuid,
    question text NOT NULL,
    reason text,
    related_attribute character varying(30),
    priority character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    resolution_status character varying(10) DEFAULT 'open'::character varying NOT NULL,
    resolution_notes text,
    origin character varying(10) NOT NULL,
    review_status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_missing_information_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_missing_information_priority CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT ck_missing_information_related_attribute CHECK (((related_attribute)::text = ANY ((ARRAY['problem'::character varying, 'solution'::character varying, 'customer_segment'::character varying, 'product_service'::character varying, 'channels'::character varying, 'revenue_model'::character varying, 'geographic_scope'::character varying, 'differentiators'::character varying, 'technologies'::character varying])::text[]))),
    CONSTRAINT ck_missing_information_resolution_status CHECK (((resolution_status)::text = ANY ((ARRAY['open'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[]))),
    CONSTRAINT ck_missing_information_review_status CHECK (((review_status)::text = ANY ((ARRAY['proposed'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunities (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    run_id uuid,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    potential character varying(15) DEFAULT 'undetermined'::character varying NOT NULL,
    origin character varying(10) NOT NULL,
    review_status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_opportunities_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_opportunities_potential CHECK (((potential)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'undetermined'::character varying])::text[]))),
    CONSTRAINT ck_opportunities_review_status CHECK (((review_status)::text = ANY ((ARRAY['proposed'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: opportunity_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunity_findings (
    opportunity_id uuid NOT NULL,
    finding_id uuid NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    raw_idea text NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_projects_raw_idea_length CHECK (((char_length(raw_idea) >= 20) AND (char_length(raw_idea) <= 5000))),
    CONSTRAINT ck_projects_status CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'structured'::character varying, 'researching'::character varying, 'analyzed'::character varying])::text[]))),
    CONSTRAINT ck_projects_title_not_blank CHECK ((btrim((title)::text) <> ''::text))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_refresh_tokens_expiry_after_creation CHECK ((expires_at > created_at))
);


--
-- Name: report_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_sections (
    id uuid DEFAULT uuidv7() NOT NULL,
    report_id uuid NOT NULL,
    section_type character varying(30) NOT NULL,
    "position" smallint NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    verdict jsonb,
    CONSTRAINT ck_report_sections_section_type CHECK (((section_type)::text = ANY ((ARRAY['executive_summary'::character varying, 'idea_overview'::character varying, 'market'::character varying, 'competition'::character varying, 'opportunities'::character varying, 'risks'::character varying, 'hypotheses'::character varying, 'missing_information'::character varying, 'sources'::character varying, 'conclusions'::character varying])::text[])))
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    run_id uuid,
    version integer NOT NULL,
    title character varying(200) NOT NULL,
    status character varying(15) DEFAULT 'generating'::character varying NOT NULL,
    ai_provider character varying(20) NOT NULL,
    ai_model character varying(100) NOT NULL,
    error_code character varying(50),
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    geographic_scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT ck_reports_ai_provider CHECK (((ai_provider)::text = ANY ((ARRAY['engine'::character varying, 'fake'::character varying, 'legacy'::character varying])::text[]))),
    CONSTRAINT ck_reports_status CHECK (((status)::text = ANY ((ARRAY['generating'::character varying, 'completed'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT ck_reports_version_positive CHECK ((version > 0))
);


--
-- Name: research_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_queries (
    id uuid DEFAULT uuidv7() NOT NULL,
    run_id uuid NOT NULL,
    "position" smallint NOT NULL,
    category character varying(20) NOT NULL,
    question text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    response_text text,
    executed_queries jsonb DEFAULT '[]'::jsonb NOT NULL,
    search_suggestions_html text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_research_queries_category CHECK (((category)::text = ANY ((ARRAY['market'::character varying, 'customers'::character varying, 'competition'::character varying, 'substitutes'::character varying, 'technology'::character varying, 'regulation'::character varying, 'pricing'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ck_research_queries_executed_queries_array CHECK ((jsonb_typeof(executed_queries) = 'array'::text)),
    CONSTRAINT ck_research_queries_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: research_query_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_query_sources (
    query_id uuid NOT NULL,
    source_id uuid NOT NULL,
    was_cited boolean NOT NULL,
    rank smallint
);


--
-- Name: research_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_runs (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    current_step character varying(20),
    progress_pct smallint DEFAULT 0 NOT NULL,
    ai_provider character varying(20) NOT NULL,
    ai_model character varying(100) NOT NULL,
    error_code character varying(50),
    error_message text,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_research_runs_ai_provider CHECK (((ai_provider)::text = ANY ((ARRAY['engine'::character varying, 'fake'::character varying, 'legacy'::character varying])::text[]))),
    CONSTRAINT ck_research_runs_current_step CHECK (((current_step)::text = ANY ((ARRAY['planning'::character varying, 'searching'::character varying, 'extracting'::character varying, 'analyzing'::character varying, 'scoring'::character varying])::text[]))),
    CONSTRAINT ck_research_runs_dates_order CHECK (((finished_at IS NULL) OR (started_at IS NULL) OR (finished_at >= started_at))),
    CONSTRAINT ck_research_runs_progress_range CHECK (((progress_pct >= 0) AND (progress_pct <= 100))),
    CONSTRAINT ck_research_runs_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'interrupted'::character varying])::text[])))
);


--
-- Name: risk_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_findings (
    risk_id uuid NOT NULL,
    finding_id uuid NOT NULL
);


--
-- Name: risks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risks (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    run_id uuid,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    category character varying(20) NOT NULL,
    likelihood character varying(15) DEFAULT 'undetermined'::character varying NOT NULL,
    impact character varying(15) DEFAULT 'undetermined'::character varying NOT NULL,
    mitigation text,
    origin character varying(10) NOT NULL,
    review_status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_risks_category CHECK (((category)::text = ANY ((ARRAY['market'::character varying, 'competition'::character varying, 'technical'::character varying, 'regulatory'::character varying, 'financial'::character varying, 'operational'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT ck_risks_impact CHECK (((impact)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'undetermined'::character varying])::text[]))),
    CONSTRAINT ck_risks_likelihood CHECK (((likelihood)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'undetermined'::character varying])::text[]))),
    CONSTRAINT ck_risks_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_risks_review_status CHECK (((review_status)::text = ANY ((ARRAY['proposed'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    url text NOT NULL,
    canonical_url text NOT NULL,
    domain character varying(255) NOT NULL,
    title text,
    source_type character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_sources_source_type CHECK (((source_type)::text = ANY ((ARRAY['news'::character varying, 'company_site'::character varying, 'government'::character varying, 'academic'::character varying, 'marketplace'::character varying, 'social'::character varying, 'blog'::character varying, 'review_site'::character varying, 'other'::character varying, 'unknown'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    email public.citext NOT NULL,
    password_hash text NOT NULL,
    full_name character varying(120) NOT NULL,
    role character varying(10) DEFAULT 'user'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    supabase_user_id uuid,
    CONSTRAINT ck_users_email_length CHECK ((char_length((email)::text) <= 254)),
    CONSTRAINT ck_users_full_name_not_blank CHECK ((btrim((full_name)::text) <> ''::text)),
    CONSTRAINT ck_users_role CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: validation_hypotheses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validation_hypotheses (
    id uuid DEFAULT uuidv7() NOT NULL,
    project_id uuid NOT NULL,
    run_id uuid,
    statement text NOT NULL,
    related_attribute character varying(30),
    validation_method text,
    success_criteria text,
    priority character varying(10) DEFAULT 'medium'::character varying NOT NULL,
    validation_status character varying(15) DEFAULT 'pending'::character varying NOT NULL,
    result_notes text,
    origin character varying(10) NOT NULL,
    review_status character varying(10) DEFAULT 'proposed'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_validation_hypotheses_origin CHECK (((origin)::text = ANY ((ARRAY['ai'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT ck_validation_hypotheses_priority CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT ck_validation_hypotheses_related_attribute CHECK (((related_attribute)::text = ANY ((ARRAY['problem'::character varying, 'solution'::character varying, 'customer_segment'::character varying, 'product_service'::character varying, 'channels'::character varying, 'revenue_model'::character varying, 'geographic_scope'::character varying, 'differentiators'::character varying, 'technologies'::character varying])::text[]))),
    CONSTRAINT ck_validation_hypotheses_review_status CHECK (((review_status)::text = ANY ((ARRAY['proposed'::character varying, 'accepted'::character varying, 'rejected'::character varying])::text[]))),
    CONSTRAINT ck_validation_hypotheses_validation_status CHECK (((validation_status)::text = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'validated'::character varying, 'invalidated'::character varying, 'inconclusive'::character varying])::text[])))
);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: ai_api_logs pk_ai_api_logs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_api_logs
    ADD CONSTRAINT pk_ai_api_logs PRIMARY KEY (id);


--
-- Name: competitors pk_competitors; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT pk_competitors PRIMARY KEY (id);


--
-- Name: entities pk_entities; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT pk_entities PRIMARY KEY (id);


--
-- Name: entity_aliases pk_entity_aliases; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT pk_entity_aliases PRIMARY KEY (id);


--
-- Name: evidence pk_evidence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT pk_evidence PRIMARY KEY (id);


--
-- Name: finding_entities pk_finding_entities; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_entities
    ADD CONSTRAINT pk_finding_entities PRIMARY KEY (finding_id, entity_id);


--
-- Name: finding_evidence pk_finding_evidence; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_evidence
    ADD CONSTRAINT pk_finding_evidence PRIMARY KEY (finding_id, evidence_id);


--
-- Name: findings pk_findings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT pk_findings PRIMARY KEY (id);


--
-- Name: hypothesis_findings pk_hypothesis_findings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hypothesis_findings
    ADD CONSTRAINT pk_hypothesis_findings PRIMARY KEY (hypothesis_id, finding_id);


--
-- Name: idea_attributes pk_idea_attributes; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idea_attributes
    ADD CONSTRAINT pk_idea_attributes PRIMARY KEY (id);


--
-- Name: missing_information pk_missing_information; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missing_information
    ADD CONSTRAINT pk_missing_information PRIMARY KEY (id);


--
-- Name: opportunities pk_opportunities; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT pk_opportunities PRIMARY KEY (id);


--
-- Name: opportunity_findings pk_opportunity_findings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_findings
    ADD CONSTRAINT pk_opportunity_findings PRIMARY KEY (opportunity_id, finding_id);


--
-- Name: projects pk_projects; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT pk_projects PRIMARY KEY (id);


--
-- Name: refresh_tokens pk_refresh_tokens; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT pk_refresh_tokens PRIMARY KEY (id);


--
-- Name: report_sections pk_report_sections; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_sections
    ADD CONSTRAINT pk_report_sections PRIMARY KEY (id);


--
-- Name: reports pk_reports; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT pk_reports PRIMARY KEY (id);


--
-- Name: research_queries pk_research_queries; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_queries
    ADD CONSTRAINT pk_research_queries PRIMARY KEY (id);


--
-- Name: research_query_sources pk_research_query_sources; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_query_sources
    ADD CONSTRAINT pk_research_query_sources PRIMARY KEY (query_id, source_id);


--
-- Name: research_runs pk_research_runs; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_runs
    ADD CONSTRAINT pk_research_runs PRIMARY KEY (id);


--
-- Name: risk_findings pk_risk_findings; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_findings
    ADD CONSTRAINT pk_risk_findings PRIMARY KEY (risk_id, finding_id);


--
-- Name: risks pk_risks; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT pk_risks PRIMARY KEY (id);


--
-- Name: sources pk_sources; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT pk_sources PRIMARY KEY (id);


--
-- Name: users pk_users; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT pk_users PRIMARY KEY (id);


--
-- Name: validation_hypotheses pk_validation_hypotheses; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_hypotheses
    ADD CONSTRAINT pk_validation_hypotheses PRIMARY KEY (id);


--
-- Name: competitors uq_competitors_project_id_entity_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT uq_competitors_project_id_entity_id UNIQUE (project_id, entity_id);


--
-- Name: entities uq_entities_id_project_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT uq_entities_id_project_id UNIQUE (id, project_id);


--
-- Name: entities uq_entities_project_id_entity_type_normalized_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT uq_entities_project_id_entity_type_normalized_name UNIQUE (project_id, entity_type, normalized_name);


--
-- Name: entity_aliases uq_entity_aliases_entity_id_normalized_alias; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT uq_entity_aliases_entity_id_normalized_alias UNIQUE (entity_id, normalized_alias);


--
-- Name: idea_attributes uq_idea_attributes_project_id_attribute_type_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idea_attributes
    ADD CONSTRAINT uq_idea_attributes_project_id_attribute_type_position UNIQUE (project_id, attribute_type, "position");


--
-- Name: refresh_tokens uq_refresh_tokens_token_hash; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash);


--
-- Name: report_sections uq_report_sections_report_id_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_sections
    ADD CONSTRAINT uq_report_sections_report_id_position UNIQUE (report_id, "position");


--
-- Name: report_sections uq_report_sections_report_id_section_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_sections
    ADD CONSTRAINT uq_report_sections_report_id_section_type UNIQUE (report_id, section_type);


--
-- Name: reports uq_reports_project_id_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT uq_reports_project_id_version UNIQUE (project_id, version);


--
-- Name: research_queries uq_research_queries_run_id_position; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_queries
    ADD CONSTRAINT uq_research_queries_run_id_position UNIQUE (run_id, "position");


--
-- Name: research_runs uq_research_runs_id_project_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_runs
    ADD CONSTRAINT uq_research_runs_id_project_id UNIQUE (id, project_id);


--
-- Name: sources uq_sources_id_project_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT uq_sources_id_project_id UNIQUE (id, project_id);


--
-- Name: sources uq_sources_project_id_canonical_url; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT uq_sources_project_id_canonical_url UNIQUE (project_id, canonical_url);


--
-- Name: users uq_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_email UNIQUE (email);


--
-- Name: users uq_users_supabase_user_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_supabase_user_id UNIQUE (supabase_user_id);


--
-- Name: ix_ai_api_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_api_logs_created_at ON public.ai_api_logs USING btree (created_at);


--
-- Name: ix_ai_api_logs_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_api_logs_project_id ON public.ai_api_logs USING btree (project_id);


--
-- Name: ix_ai_api_logs_research_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_api_logs_research_run_id ON public.ai_api_logs USING btree (research_run_id);


--
-- Name: ix_ai_api_logs_user_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_api_logs_user_id_created_at ON public.ai_api_logs USING btree (user_id, created_at DESC);


--
-- Name: ix_entities_normalized_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entities_normalized_name_trgm ON public.entities USING gin (normalized_name public.gin_trgm_ops);


--
-- Name: ix_entity_aliases_normalized_alias_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_entity_aliases_normalized_alias_trgm ON public.entity_aliases USING gin (normalized_alias public.gin_trgm_ops);


--
-- Name: ix_evidence_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_evidence_project_id ON public.evidence USING btree (project_id);


--
-- Name: ix_evidence_query_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_evidence_query_id ON public.evidence USING btree (query_id);


--
-- Name: ix_evidence_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_evidence_source_id ON public.evidence USING btree (source_id);


--
-- Name: ix_finding_entities_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_finding_entities_entity_id ON public.finding_entities USING btree (entity_id);


--
-- Name: ix_finding_evidence_evidence_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_finding_evidence_evidence_id ON public.finding_evidence USING btree (evidence_id);


--
-- Name: ix_findings_project_id_finding_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_project_id_finding_type ON public.findings USING btree (project_id, finding_type);


--
-- Name: ix_findings_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_findings_run_id ON public.findings USING btree (run_id);


--
-- Name: ix_hypothesis_findings_finding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_hypothesis_findings_finding_id ON public.hypothesis_findings USING btree (finding_id);


--
-- Name: ix_missing_information_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_missing_information_project_id ON public.missing_information USING btree (project_id);


--
-- Name: ix_opportunities_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_opportunities_project_id ON public.opportunities USING btree (project_id);


--
-- Name: ix_opportunity_findings_finding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_opportunity_findings_finding_id ON public.opportunity_findings USING btree (finding_id);


--
-- Name: ix_projects_user_id_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_projects_user_id_updated_at ON public.projects USING btree (user_id, updated_at DESC);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: ix_research_query_sources_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_research_query_sources_source_id ON public.research_query_sources USING btree (source_id);


--
-- Name: ix_research_runs_project_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_research_runs_project_id_created_at ON public.research_runs USING btree (project_id, created_at DESC);


--
-- Name: ix_risk_findings_finding_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_risk_findings_finding_id ON public.risk_findings USING btree (finding_id);


--
-- Name: ix_risks_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_risks_project_id ON public.risks USING btree (project_id);


--
-- Name: ix_sources_project_id_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sources_project_id_domain ON public.sources USING btree (project_id, domain);


--
-- Name: ix_validation_hypotheses_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_validation_hypotheses_project_id ON public.validation_hypotheses USING btree (project_id);


--
-- Name: uq_research_runs_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_research_runs_one_active ON public.research_runs USING btree (project_id) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying])::text[]));


--
-- Name: competitors trg_competitors_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_competitors_updated_at BEFORE UPDATE ON public.competitors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entities trg_entities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: findings trg_findings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_findings_updated_at BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: idea_attributes trg_idea_attributes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_idea_attributes_updated_at BEFORE UPDATE ON public.idea_attributes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: missing_information trg_missing_information_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_missing_information_updated_at BEFORE UPDATE ON public.missing_information FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: opportunities trg_opportunities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects trg_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: research_runs trg_research_runs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_research_runs_updated_at BEFORE UPDATE ON public.research_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: risks trg_risks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_risks_updated_at BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: validation_hypotheses trg_validation_hypotheses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validation_hypotheses_updated_at BEFORE UPDATE ON public.validation_hypotheses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ai_api_logs fk_ai_api_logs_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_api_logs
    ADD CONSTRAINT fk_ai_api_logs_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: ai_api_logs fk_ai_api_logs_research_run_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_api_logs
    ADD CONSTRAINT fk_ai_api_logs_research_run_id_research_runs FOREIGN KEY (research_run_id) REFERENCES public.research_runs(id) ON DELETE SET NULL;


--
-- Name: ai_api_logs fk_ai_api_logs_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_api_logs
    ADD CONSTRAINT fk_ai_api_logs_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: competitors fk_competitors_entity_id_project_id_entities; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT fk_competitors_entity_id_project_id_entities FOREIGN KEY (entity_id, project_id) REFERENCES public.entities(id, project_id) ON DELETE CASCADE;


--
-- Name: competitors fk_competitors_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT fk_competitors_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: competitors fk_competitors_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT fk_competitors_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE SET NULL (run_id);


--
-- Name: entities fk_entities_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT fk_entities_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: entity_aliases fk_entity_aliases_entity_id_entities; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_aliases
    ADD CONSTRAINT fk_entity_aliases_entity_id_entities FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: evidence fk_evidence_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT fk_evidence_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: evidence fk_evidence_query_id_research_queries; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT fk_evidence_query_id_research_queries FOREIGN KEY (query_id) REFERENCES public.research_queries(id) ON DELETE CASCADE;


--
-- Name: evidence fk_evidence_source_id_project_id_sources; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evidence
    ADD CONSTRAINT fk_evidence_source_id_project_id_sources FOREIGN KEY (source_id, project_id) REFERENCES public.sources(id, project_id) ON DELETE CASCADE;


--
-- Name: finding_entities fk_finding_entities_entity_id_entities; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_entities
    ADD CONSTRAINT fk_finding_entities_entity_id_entities FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE CASCADE;


--
-- Name: finding_entities fk_finding_entities_finding_id_findings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_entities
    ADD CONSTRAINT fk_finding_entities_finding_id_findings FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;


--
-- Name: finding_evidence fk_finding_evidence_evidence_id_evidence; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_evidence
    ADD CONSTRAINT fk_finding_evidence_evidence_id_evidence FOREIGN KEY (evidence_id) REFERENCES public.evidence(id) ON DELETE CASCADE;


--
-- Name: finding_evidence fk_finding_evidence_finding_id_findings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finding_evidence
    ADD CONSTRAINT fk_finding_evidence_finding_id_findings FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;


--
-- Name: findings fk_findings_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT fk_findings_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: findings fk_findings_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.findings
    ADD CONSTRAINT fk_findings_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE CASCADE;


--
-- Name: hypothesis_findings fk_hypothesis_findings_finding_id_findings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hypothesis_findings
    ADD CONSTRAINT fk_hypothesis_findings_finding_id_findings FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;


--
-- Name: hypothesis_findings fk_hypothesis_findings_hypothesis_id_validation_hypotheses; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hypothesis_findings
    ADD CONSTRAINT fk_hypothesis_findings_hypothesis_id_validation_hypotheses FOREIGN KEY (hypothesis_id) REFERENCES public.validation_hypotheses(id) ON DELETE CASCADE;


--
-- Name: idea_attributes fk_idea_attributes_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idea_attributes
    ADD CONSTRAINT fk_idea_attributes_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: missing_information fk_missing_information_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missing_information
    ADD CONSTRAINT fk_missing_information_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: missing_information fk_missing_information_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missing_information
    ADD CONSTRAINT fk_missing_information_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE SET NULL (run_id);


--
-- Name: opportunities fk_opportunities_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT fk_opportunities_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: opportunities fk_opportunities_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT fk_opportunities_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE SET NULL (run_id);


--
-- Name: opportunity_findings fk_opportunity_findings_finding_id_findings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_findings
    ADD CONSTRAINT fk_opportunity_findings_finding_id_findings FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;


--
-- Name: opportunity_findings fk_opportunity_findings_opportunity_id_opportunities; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunity_findings
    ADD CONSTRAINT fk_opportunity_findings_opportunity_id_opportunities FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE CASCADE;


--
-- Name: projects fk_projects_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fk_projects_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens fk_refresh_tokens_replaced_by_id_refresh_tokens; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_replaced_by_id_refresh_tokens FOREIGN KEY (replaced_by_id) REFERENCES public.refresh_tokens(id) ON DELETE SET NULL;


--
-- Name: refresh_tokens fk_refresh_tokens_user_id_users; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk_refresh_tokens_user_id_users FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: report_sections fk_report_sections_report_id_reports; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_sections
    ADD CONSTRAINT fk_report_sections_report_id_reports FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: reports fk_reports_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_reports_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: reports fk_reports_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT fk_reports_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE SET NULL (run_id);


--
-- Name: research_queries fk_research_queries_run_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_queries
    ADD CONSTRAINT fk_research_queries_run_id_research_runs FOREIGN KEY (run_id) REFERENCES public.research_runs(id) ON DELETE CASCADE;


--
-- Name: research_query_sources fk_research_query_sources_query_id_research_queries; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_query_sources
    ADD CONSTRAINT fk_research_query_sources_query_id_research_queries FOREIGN KEY (query_id) REFERENCES public.research_queries(id) ON DELETE CASCADE;


--
-- Name: research_query_sources fk_research_query_sources_source_id_sources; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_query_sources
    ADD CONSTRAINT fk_research_query_sources_source_id_sources FOREIGN KEY (source_id) REFERENCES public.sources(id) ON DELETE CASCADE;


--
-- Name: research_runs fk_research_runs_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_runs
    ADD CONSTRAINT fk_research_runs_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: risk_findings fk_risk_findings_finding_id_findings; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_findings
    ADD CONSTRAINT fk_risk_findings_finding_id_findings FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE CASCADE;


--
-- Name: risk_findings fk_risk_findings_risk_id_risks; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_findings
    ADD CONSTRAINT fk_risk_findings_risk_id_risks FOREIGN KEY (risk_id) REFERENCES public.risks(id) ON DELETE CASCADE;


--
-- Name: risks fk_risks_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT fk_risks_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: risks fk_risks_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT fk_risks_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE SET NULL (run_id);


--
-- Name: sources fk_sources_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT fk_sources_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: validation_hypotheses fk_validation_hypotheses_project_id_projects; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_hypotheses
    ADD CONSTRAINT fk_validation_hypotheses_project_id_projects FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: validation_hypotheses fk_validation_hypotheses_run_id_project_id_research_runs; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_hypotheses
    ADD CONSTRAINT fk_validation_hypotheses_run_id_project_id_research_runs FOREIGN KEY (run_id, project_id) REFERENCES public.research_runs(id, project_id) ON DELETE SET NULL (run_id);


--
-- PostgreSQL database dump complete
--

\unrestrict J8st9MDuilOgt4fK8sAVclBqzXqHg25bgZbdBJwheFT7xadDSnbEZt4kOXFc5la


-- 4. Versión de migraciones de Alembic (head). Sin esto, "alembic upgrade head" intentaría crear las tablas otra vez.
INSERT INTO public.alembic_version (version_num) VALUES ('d8a24b6e91c0');
RESET ROLE;

-- 5. Base de pruebas: vacía. Los tests crean y borran su propia estructura.
\c ideaforge_test
GRANT ALL ON SCHEMA public TO ideaforge;
