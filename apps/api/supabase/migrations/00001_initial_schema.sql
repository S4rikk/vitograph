-- ============================================================================
-- VITOGRAPH — Initial Database Schema
-- Migration: 00001_initial_schema.sql
-- PostgreSQL 15+ (Supabase)
-- ============================================================================
-- Conventions applied:
--   • bigint generated always as identity (PKs for internal tables)
--   • uuid for profiles.id (matches auth.users(id))
--   • text instead of varchar(n) everywhere
--   • timestamptz for all temporal columns
--   • numeric(p,s) for numeric data
--   • Explicit indexes on all FK columns
--   • text + CHECK constraints for enums
--   • Row-Level Security (RLS) on all user-facing tables
-- ============================================================================
-- ────────────────────────────────────────────────────────────────────────────
-- 0. Reusable trigger function: auto-update `updated_at`
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.trigger_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now();
return new;
end;
$$;
-- ────────────────────────────────────────────────────────────────────────────
-- 1. profiles — Extended User Profile (1:1 with auth.users)
-- ────────────────────────────────────────────────────────────────────────────
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    date_of_birth date,
    biological_sex text constraint profiles_biological_sex_check check (
        biological_sex in (
            'male',
            'female',
            'other'
        )
    ),
    height_cm numeric(5, 1),
    weight_kg numeric(5, 1),
    activity_level text constraint profiles_activity_level_check check (
        activity_level in (
            'sedentary',
            'light',
            'moderate',
            'active',
            'very_active'
        )
    ),
    stress_level text constraint profiles_stress_level_check check (
        stress_level in (
            'low',
            'moderate',
            'high',
            'very_high'
        )
    ),
    sleep_hours_avg numeric(3, 1),
    climate_zone text constraint profiles_climate_zone_check check (
        climate_zone in (
            'tropical',
            'dry',
            'temperate',
            'continental',
            'polar'
        )
    ),
    sun_exposure text constraint profiles_sun_exposure_check check (
        sun_exposure in (
            'minimal',
            'moderate',
            'high'
        )
    ),
    diet_type text constraint profiles_diet_type_check check (
        diet_type in (
            'omnivore',
            'vegetarian',
            'vegan',
            'pescatarian',
            'keto',
            'other'
        )
    ),
    is_smoker boolean not null default false,
    alcohol_frequency text constraint profiles_alcohol_frequency_check check (
        alcohol_frequency in (
            'none',
            'occasional',
            'moderate',
            'heavy'
        )
    ),
    pregnancy_status text constraint profiles_pregnancy_status_check check (
        pregnancy_status in (
            'not_applicable',
            'pregnant',
            'breastfeeding'
        )
    ),
    chronic_conditions jsonb default '[]'::jsonb,
    medications jsonb default '[]'::jsonb,
    city text,
    timezone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- Trigger: auto-update updated_at
create trigger profiles_set_updated_at before
update on public.profiles for each row execute function public.trigger_set_updated_at();
-- RLS: owner-only CRUD
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy profiles_owner_policy on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- ────────────────────────────────────────────────────────────────────────────
-- 2. biomarkers — Dictionary of Supported Blood Markers
-- ────────────────────────────────────────────────────────────────────────────
create table public.biomarkers (
    id bigint generated always as identity primary key,
    code text not null,
    name_en text not null,
    name_ru text,
    category text not null constraint biomarkers_category_check check (
        category in (
            'vitamin',
            'mineral',
            'hormone',
            'enzyme',
            'lipid',
            'other'
        )
    ),
    unit text not null,
    ref_range_low numeric(10, 3),
    ref_range_high numeric(10, 3),
    optimal_range_low numeric(10, 3),
    optimal_range_high numeric(10, 3),
    description text,
    aliases jsonb default '[]'::jsonb,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- Unique index on code (machine-readable identifier)
create unique index biomarkers_code_idx on public.biomarkers (code);
-- Index on category for filtered queries
create index biomarkers_category_idx on public.biomarkers (category);
-- Trigger: auto-update updated_at
create trigger biomarkers_set_updated_at before
update on public.biomarkers for each row execute function public.trigger_set_updated_at();
-- RLS: read-only for all authenticated users, writes via service_role only
alter table public.biomarkers enable row level security;
alter table public.biomarkers force row level security;
create policy biomarkers_read_policy on public.biomarkers for
select to authenticated using (true);
-- ────────────────────────────────────────────────────────────────────────────
-- 3. test_sessions — Grouping Test Results by Upload
-- ────────────────────────────────────────────────────────────────────────────
create table public.test_sessions (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles (id) on delete cascade,
    test_date date not null,
    lab_name text,
    source_file_path text,
    status text not null default 'pending' constraint test_sessions_status_check check (
        status in (
            'pending',
            'processing',
            'completed',
            'error'
        )
    ),
    notes text,
    created_at timestamptz not null default now()
);
-- Explicit FK index (postgres does NOT auto-index FKs)
create index test_sessions_user_id_idx on public.test_sessions (user_id);
-- RLS: owner-only access
alter table public.test_sessions enable row level security;
alter table public.test_sessions force row level security;
create policy test_sessions_owner_policy on public.test_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- ────────────────────────────────────────────────────────────────────────────
-- 4. test_results — Individual Biomarker Values from Blood Tests
-- ────────────────────────────────────────────────────────────────────────────
create table public.test_results (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles (id) on delete cascade,
    biomarker_id bigint not null references public.biomarkers (id),
    session_id bigint references public.test_sessions (id) on delete
    set null,
        value numeric(10, 3) not null,
        unit text not null,
        test_date date not null,
        lab_name text,
        source text not null default 'manual' constraint test_results_source_check check (
            source in (
                'manual',
                'ocr_upload',
                'api_integration'
            )
        ),
        source_file_path text,
        notes text,
        created_at timestamptz not null default now()
);
-- Explicit FK indexes
create index test_results_user_id_idx on public.test_results (user_id);
create index test_results_biomarker_id_idx on public.test_results (biomarker_id);
create index test_results_session_id_idx on public.test_results (session_id);
-- Composite index for fast timeline queries
create index test_results_user_date_idx on public.test_results (user_id, test_date desc);
-- RLS: owner-only CRUD
alter table public.test_results enable row level security;
alter table public.test_results force row level security;
create policy test_results_owner_policy on public.test_results for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- ────────────────────────────────────────────────────────────────────────────
-- 5. dynamic_norm_rules — Rules for Shifting Reference Ranges
-- ────────────────────────────────────────────────────────────────────────────
-- Core IP: defines how lifestyle/environment factors shift biomarker norms.
-- `operation` + `adjustment_value` provide mathematical flexibility:
--   operation = 'add'        → ref_range += adjustment_value
--   operation = 'multiply'   → ref_range *= adjustment_value
--   operation = 'percentage' → ref_range += ref_range * (adjustment_value / 100)
-- ────────────────────────────────────────────────────────────────────────────
create table public.dynamic_norm_rules (
    id bigint generated always as identity primary key,
    biomarker_id bigint not null references public.biomarkers (id),
    factor_type text not null,
    factor_value text not null,
    adjustment_type text not null constraint dynamic_norm_rules_adjustment_type_check check (
        adjustment_type in (
            'absolute',
            'percentage',
            'override'
        )
    ),
    operation text not null default 'add' constraint dynamic_norm_rules_operation_check check (
        operation in (
            'add',
            'multiply',
            'percentage'
        )
    ),
    adjustment_value numeric(10, 3) not null default 0,
    low_adjustment numeric(10, 3) not null default 0,
    high_adjustment numeric(10, 3) not null default 0,
    priority integer not null default 0,
    rationale text,
    source_reference text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
-- Explicit FK index
create index dynamic_norm_rules_biomarker_id_idx on public.dynamic_norm_rules (biomarker_id);
-- Composite index for fast rule lookup
create index dynamic_norm_rules_factor_idx on public.dynamic_norm_rules (biomarker_id, factor_type, factor_value);
-- Trigger: auto-update updated_at
create trigger dynamic_norm_rules_set_updated_at before
update on public.dynamic_norm_rules for each row execute function public.trigger_set_updated_at();
-- RLS: read-only for authenticated users, writes via service_role only
alter table public.dynamic_norm_rules enable row level security;
alter table public.dynamic_norm_rules force row level security;
create policy dynamic_norm_rules_read_policy on public.dynamic_norm_rules for
select to authenticated using (true);
-- ────────────────────────────────────────────────────────────────────────────
-- 6. user_dynamic_norms — Computed Personal Ranges (Cache)
-- ────────────────────────────────────────────────────────────────────────────
create table public.user_dynamic_norms (
    id bigint generated always as identity primary key,
    user_id uuid not null references public.profiles (id) on delete cascade,
    biomarker_id bigint not null references public.biomarkers (id),
    computed_low numeric(10, 3) not null,
    computed_high numeric(10, 3) not null,
    applied_rules jsonb not null default '[]'::jsonb,
    computed_at timestamptz not null default now()
);
-- Unique constraint: one norm per user per biomarker
alter table public.user_dynamic_norms
add constraint user_dynamic_norms_user_biomarker_uq unique (user_id, biomarker_id);
-- Explicit FK indexes
create index user_dynamic_norms_user_id_idx on public.user_dynamic_norms (user_id);
create index user_dynamic_norms_biomarker_id_idx on public.user_dynamic_norms (biomarker_id);
-- RLS: owner can read their own norms only
alter table public.user_dynamic_norms enable row level security;
alter table public.user_dynamic_norms force row level security;
create policy user_dynamic_norms_owner_policy on public.user_dynamic_norms for
select to authenticated using (auth.uid() = user_id);
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================