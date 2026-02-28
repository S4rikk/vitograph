/**
 * ═══════════════════════════════════════════════════════════════════════
 * VITOGRAPH — Health Core Data Architecture
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for the VitoGraph "Knowledge Core".
 * Defines the relational TypeScript type system across 5 multimodal
 * health domains and the AI scoring engine.
 *
 * ARCHITECTURE PHILOSOPHY:
 * - Every entity is timestamped and user-scoped (RLS-ready).
 * - Branded types prevent accidental ID mixing (UUID vs bigint).
 * - AI cross-query paths are documented inline via JSDoc.
 * - Mirrors existing Supabase SQL schema where applicable.
 *
 * DOMAINS:
 *   D1 — User Context & Environment
 *   D2 — Bio-Data & Genetics
 *   D3 — Metabolic & Gut Health
 *   D4 — Recovery & Wearables
 *   D5 — AI Scoring Engine
 *
 * @module health-core
 * @version 1.0.0
 */

// ════════════════════════════════════════════════════════════════════════
// §0  COMMON PRIMITIVES
// ════════════════════════════════════════════════════════════════════════

/**
 * Branded type pattern — prevents accidental mixing of IDs.
 * Example: a `UserId` cannot be passed where a `BiomarkerId` is expected.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** ISO-8601 datetime string (e.g. "2026-02-18T09:00:00+08:00"). */
export type ISODateTime = Brand<string, "ISODateTime">;

/** UUID v4/v7 string identifier. */
export type UUID = Brand<string, "UUID">;

/** Database bigint identity — serialized as number in TypeScript. */
export type BigIntId = Brand<number, "BigIntId">;

// ── Domain-specific ID aliases ──────────────────────────────────────
export type UserId = Brand<string, "UserId">;
export type BiomarkerId = Brand<number, "BiomarkerId">;
export type SessionId = Brand<number, "SessionId">;
export type RuleId = Brand<number, "RuleId">;
export type GeneticVariantId = Brand<number, "GeneticVariantId">;
export type MedicationId = Brand<number, "MedicationId">;
export type MealLogId = Brand<number, "MealLogId">;
export type SleepSessionId = Brand<number, "SleepSessionId">;
export type HealthspanScoreId = Brand<number, "HealthspanScoreId">;
export type InsightId = Brand<number, "InsightId">;

/** Shared base for all persisted entities. */
export interface TimestampedEntity {
  readonly created_at: ISODateTime;
}

/** Extended base for entities that track updates. */
export interface MutableEntity extends TimestampedEntity {
  readonly updated_at: ISODateTime;
}

// ════════════════════════════════════════════════════════════════════════
// §1  DOMAIN 1 — USER CONTEXT & ENVIRONMENT
// ════════════════════════════════════════════════════════════════════════

/**
 * Extended user profile — 1:1 mirror of `public.profiles` SQL table.
 * Stores lifestyle and environment factors for Dynamic Norm computation.
 *
 * AI QUERY PATH: The scoring engine reads `activity_level`, `stress_level`,
 * `sleep_hours_avg`, and `climate_zone` to weight biomarker norms and
 * correlate lifestyle factors with recovery/metabolic patterns.
 */
export interface UserProfile extends MutableEntity {
  readonly id: UserId;
  readonly display_name: string | null;
  readonly date_of_birth: string | null; // ISO date "YYYY-MM-DD"
  readonly biological_sex: BiologicalSex;
  readonly height_cm: number | null;
  readonly weight_kg: number | null;
  readonly activity_level: ActivityLevel;
  readonly stress_level: StressLevel;
  readonly sleep_hours_avg: number | null;
  readonly climate_zone: ClimateZone;
  readonly sun_exposure: SunExposure;
  readonly diet_type: DietType;
  readonly is_smoker: boolean;
  readonly alcohol_frequency: AlcoholFrequency;
  readonly pregnancy_status: PregnancyStatus;
  readonly chronic_conditions: string[];
  readonly medications: string[];
  readonly city: string | null;
  readonly timezone: string | null; // IANA, e.g. "Asia/Singapore"

  // ── NEW: Work & Lifestyle baseline (Phase 11) ──────────────────
  /** e.g. "office_sedentary" | "manual_labor" | "remote_flexible" */
  readonly work_lifestyle: WorkLifestyle | null;
  /** Baseline mental stress on a numeric scale (1–10). */
  readonly baseline_mental_stress: number | null;
  /** Physical activity baseline: average weekly minutes of exercise. */
  readonly physical_activity_minutes_weekly: number | null;
}

export type BiologicalSex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type StressLevel = "low" | "moderate" | "high" | "very_high";
export type ClimateZone = "tropical" | "dry" | "temperate" | "continental" | "polar";
export type SunExposure = "minimal" | "moderate" | "high";
export type DietType = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "keto" | "other";
export type AlcoholFrequency = "none" | "occasional" | "moderate" | "heavy";
export type PregnancyStatus = "not_applicable" | "pregnant" | "breastfeeding";
export type WorkLifestyle = "office_sedentary" | "office_active" | "manual_labor" | "remote_flexible" | "shift_work";

/**
 * Real-time environmental telemetry reading.
 * Captured periodically (e.g., hourly) from external APIs (IQAir, OpenWeather).
 *
 * AI QUERY PATH: The engine correlates `aqi` spikes with respiratory biomarker
 * changes (eosinophils, CRP) and `temperature_celsius` with sleep quality
 * degradation. High pollen counts predict histamine-related inflammation.
 *
 * CROSS-DOMAIN LINKS:
 * - D4 (Recovery): poor AQI → disrupted deep sleep → low readiness score
 * - D2 (Bio-Data): chronic high AQI → elevated inflammatory markers
 * - D3 (Metabolic): temperature extremes → altered glucose response
 */
export interface EnvironmentReading extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly recorded_at: ISODateTime;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly region: string | null; // e.g. "Bangkok, Thailand"

  // ── Air Quality ────────────────────────────────────────────────
  /** US EPA Air Quality Index, 0–500. */
  readonly aqi: number | null;
  /** Primary pollutant: PM2.5, PM10, O3, NO2, SO2, CO. */
  readonly primary_pollutant: string | null;
  /** PM2.5 concentration in µg/m³. */
  readonly pm25: number | null;

  // ── Weather ────────────────────────────────────────────────────
  readonly temperature_celsius: number | null;
  readonly humidity_percent: number | null;
  /** UV Index (0–11+). */
  readonly uv_index: number | null;

  // ── Biological ─────────────────────────────────────────────────
  /** Pollen count level: none | low | moderate | high | very_high. */
  readonly pollen_level: PollenLevel | null;
}

export type PollenLevel = "none" | "low" | "moderate" | "high" | "very_high";

/**
 * Periodic snapshot of drinking water quality at user's location.
 * Sourced from municipal data or user's own testing kit.
 *
 * AI QUERY PATH: High water hardness → elevated calcium/magnesium intake →
 * adjust biomarker norms. Lead/fluoride presence affects kidney markers.
 */
export interface WaterQualitySnapshot extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly measured_at: ISODateTime;
  readonly source: "municipal_data" | "home_test_kit" | "manual";

  /** Total Dissolved Solids in ppm. */
  readonly tds_ppm: number | null;
  /** Water hardness in mg/L (CaCO3 equivalent). */
  readonly hardness_mgl: number | null;
  /** pH level (6.5–8.5 typical). */
  readonly ph: number | null;
  /** Lead content in ppb (parts per billion). */
  readonly lead_ppb: number | null;
  /** Fluoride in mg/L. */
  readonly fluoride_mgl: number | null;
  /** Chlorine residual in mg/L. */
  readonly chlorine_mgl: number | null;
}

// ════════════════════════════════════════════════════════════════════════
// §2  DOMAIN 2 — BIO-DATA & GENETICS
// ════════════════════════════════════════════════════════════════════════

/**
 * Biomarker dictionary — 1:1 mirror of `public.biomarkers` SQL table.
 * Reference catalog of all supported blood/lab markers.
 */
export interface Biomarker extends MutableEntity {
  readonly id: BiomarkerId;
  readonly code: string;        // e.g. "VIT_D_25OH", "FERRITIN"
  readonly name_en: string;
  readonly name_ru: string | null;
  readonly category: BiomarkerCategory;
  readonly unit: string;        // e.g. "ng/mL", "µmol/L"
  readonly ref_range_low: number | null;
  readonly ref_range_high: number | null;
  readonly optimal_range_low: number | null;
  readonly optimal_range_high: number | null;
  readonly description: string | null;
  readonly aliases: string[];   // e.g. ["25-hydroxyvitamin D", "Calcidiol"]
  readonly is_active: boolean;
}

export type BiomarkerCategory = "vitamin" | "mineral" | "hormone" | "enzyme" | "lipid" | "metabolic" | "inflammatory" | "hematologic" | "other";

/**
 * Test session — groups multiple test_results from the same blood draw.
 * 1:1 mirror of `public.test_sessions`.
 */
export interface TestSession extends TimestampedEntity {
  readonly id: SessionId;
  readonly user_id: UserId;
  readonly test_date: string; // ISO date
  readonly lab_name: string | null;
  readonly source_file_path: string | null;
  readonly status: "pending" | "processing" | "completed" | "error";
  readonly notes: string | null;
}

/**
 * Individual biomarker measurement from a lab report.
 * 1:1 mirror of `public.test_results`.
 *
 * AI QUERY PATH: The engine queries test_results as time series, grouped by
 * biomarker_id, to detect trends (improving/declining). Combined with
 * D3 (nutrition) and D4 (sleep/HRV), it correlates lifestyle changes with
 * biomarker trajectories.
 *
 * CROSS-DOMAIN LINKS:
 * - D1 (Environment): chronic high AQI → rising CRP/eosinophils
 * - D3 (Metabolic): poor glucose control → elevated HbA1c trend
 * - D4 (Recovery): low HRV baseline → elevated cortisol markers
 * - D5 (Scoring): biomarker deltas feed directly into HealthspanScore
 */
export interface TestResult extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly biomarker_id: BiomarkerId;
  readonly session_id: SessionId | null;
  readonly value: number;
  readonly unit: string;
  readonly test_date: string; // ISO date
  readonly lab_name: string | null;
  readonly source: "manual" | "ocr_upload" | "api_integration";
  readonly source_file_path: string | null;
  readonly notes: string | null;
}

/**
 * Dynamic norm rule — defines how lifestyle factors shift biomarker ranges.
 * 1:1 mirror of `public.dynamic_norm_rules`.
 */
export interface DynamicNormRule extends MutableEntity {
  readonly id: RuleId;
  readonly biomarker_id: BiomarkerId;
  readonly factor_type: string;    // e.g. "activity_level", "climate_zone"
  readonly factor_value: string;   // e.g. "very_active", "tropical"
  readonly adjustment_type: "absolute" | "percentage" | "override";
  readonly operation: "add" | "multiply" | "percentage";
  readonly adjustment_value: number;
  readonly low_adjustment: number;
  readonly high_adjustment: number;
  readonly priority: number;
  readonly rationale: string | null;
  readonly source_reference: string | null;
  readonly is_active: boolean;
}

/**
 * Cached personalized reference range per user per biomarker.
 * 1:1 mirror of `public.user_dynamic_norms`.
 */
export interface UserDynamicNorm {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly biomarker_id: BiomarkerId;
  readonly computed_low: number;
  readonly computed_high: number;
  readonly applied_rules: AppliedRuleSnapshot[];
  readonly computed_at: ISODateTime;
}

export interface AppliedRuleSnapshot {
  readonly rule_id: RuleId;
  readonly factor_type: string;
  readonly adjustment_applied: number;
}

// ── Genetics (NEW — Phase 11) ────────────────────────────────────────

/**
 * A user's known genetic variant/polymorphism.
 * Sources: 23andMe, AncestryDNA, clinical genetic testing, etc.
 *
 * AI QUERY PATH: Genetic predispositions directly modify the AI's
 * recommendations. For example:
 *   - CYP1A2 slow metabolizer → reduce caffeine advice → affects HRV/sleep
 *   - MTHFR C677T heterozygous → recommend methylfolate over folic acid
 *   - MCM6 (LCT) variant → lactose intolerance → adjust gut symptom baseline
 *   - APOE ε4 carrier → prioritize lipid panel monitoring
 *
 * CROSS-DOMAIN LINKS:
 * - D3 (Metabolic): lactose gene → gut symptoms after dairy meals
 * - D2 (Medications): CYP2D6 variants → drug metabolism speed
 * - D5 (Scoring): genetic risk factors weight the HealthspanScore
 */
export interface GeneticVariant extends TimestampedEntity {
  readonly id: GeneticVariantId;
  readonly user_id: UserId;
  readonly gene: string;            // e.g. "CYP1A2", "MTHFR", "APOE", "MCM6"
  readonly rsid: string | null;     // SNP reference, e.g. "rs762551"
  readonly variant: string;         // e.g. "C677T", "ε3/ε4"
  readonly zygosity: Zygosity;
  readonly clinical_significance: ClinicalSignificance;
  readonly phenotype_summary: string; // e.g. "Slow caffeine metabolizer"
  readonly source: GeneticSource;
  readonly raw_data_path: string | null; // path to uploaded raw data file
}

export type Zygosity = "homozygous" | "heterozygous" | "hemizygous" | "unknown";
export type ClinicalSignificance = "pathogenic" | "likely_pathogenic" | "uncertain" | "likely_benign" | "benign" | "risk_factor";
export type GeneticSource = "23andme" | "ancestrydna" | "clinical_lab" | "manual";

/**
 * Current medication or supplement a user is taking.
 * Powers the AI interaction-conflict engine.
 *
 * AI QUERY PATH: The engine cross-references active medications with:
 *   - Biomarker effects (e.g., statins → lower LDL but may elevate liver enzymes)
 *   - Supplement interactions (e.g., Vitamin K + Warfarin → dangerous)
 *   - Genetic metabolism (e.g., CYP2D6 poor metabolizer + codeine → no effect)
 *
 * CROSS-DOMAIN LINKS:
 * - D2 (Genetics): pharmacogenomic interactions
 * - D3 (Metabolic): metformin → altered glucose response pattern
 * - D4 (Recovery): beta-blockers → artificially lowered HRV
 */
export interface Medication extends MutableEntity {
  readonly id: MedicationId;
  readonly user_id: UserId;
  readonly name: string;               // e.g. "Atorvastatin", "Vitamin D3"
  readonly type: MedicationType;
  readonly dosage: string;             // e.g. "10mg", "5000 IU"
  readonly frequency: string;          // e.g. "daily", "twice_daily"
  readonly route: MedicationRoute;
  readonly start_date: string | null;  // ISO date
  readonly end_date: string | null;    // null = currently active
  readonly prescribing_reason: string | null;
  readonly is_active: boolean;

  /** RxNorm CUI or ATC code for reliable interaction lookups. */
  readonly rxnorm_code: string | null;
  readonly atc_code: string | null;
}

export type MedicationType = "prescription" | "otc" | "supplement" | "herbal";
export type MedicationRoute = "oral" | "topical" | "injection" | "sublingual" | "inhaled" | "other";

/**
 * AI-generated alert for potential drug–drug, drug–supplement,
 * or drug–gene interactions.
 *
 * AI QUERY PATH: Generated by the interaction engine when a new
 * medication is added or genetic data is uploaded. Severity levels
 * determine whether the alert is informational or blocks further
 * recommendations.
 */
export interface InteractionAlert extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly medication_id_a: MedicationId;
  readonly medication_id_b: MedicationId | null;     // null for drug-gene
  readonly genetic_variant_id: GeneticVariantId | null; // null for drug-drug
  readonly interaction_type: "drug_drug" | "drug_supplement" | "drug_gene" | "supplement_supplement";
  readonly severity: "contraindicated" | "major" | "moderate" | "minor" | "informational";
  readonly description: string;
  readonly recommendation: string;
  readonly evidence_level: "strong" | "moderate" | "weak" | "theoretical";
  readonly source_reference: string | null;
  readonly is_dismissed: boolean; // user can acknowledge & dismiss
}

// ════════════════════════════════════════════════════════════════════════
// §3  DOMAIN 3 — METABOLIC & GUT HEALTH
// ════════════════════════════════════════════════════════════════════════

/**
 * A single food item with nutritional profile.
 * Part of the platform's food database (reference data, not user-scoped).
 */
export interface FoodItem {
  readonly id: BigIntId;
  readonly name_en: string;
  readonly name_ru: string | null;
  readonly category: FoodCategory;
  readonly calories_per_100g: number;
  readonly protein_g: number;
  readonly fat_g: number;
  readonly carbs_g: number;
  readonly fiber_g: number;
  readonly glycemic_index: number | null; // 0–100
  readonly glycemic_load: number | null;
  readonly micronutrients: Record<string, number>; // { "vitamin_c_mg": 53, "iron_mg": 2.1, ... }
  readonly common_allergens: Allergen[];
  readonly is_active: boolean;
}

export type FoodCategory =
  | "grain" | "vegetable" | "fruit" | "protein_meat"
  | "protein_plant" | "dairy" | "legume" | "nut_seed"
  | "oil_fat" | "beverage" | "processed" | "other";

export type Allergen =
  | "gluten" | "dairy" | "egg" | "soy" | "peanut"
  | "tree_nut" | "fish" | "shellfish" | "sesame" | "sulfite";

/**
 * A logged meal — ties multiple food items together with timing.
 *
 * AI QUERY PATH: The engine analyzes food combinations, not just macros.
 * For example:
 *   - High-GI carb + no protein at breakfast → predict glucose spike
 *   - Iron-rich food + vitamin C → enhanced absorption → adjust iron norm
 *   - Calcium + iron at same meal → inhibited iron absorption
 *
 * CROSS-DOMAIN LINKS:
 * - D3 (CGM): meal timestamp ± 2h → correlate with glucose curve
 * - D3 (Gut): meal timestamp ± 1–6h → correlate with symptom logs
 * - D2 (Bio-Data): long-term dietary patterns → biomarker trends
 * - D1 (Environment): temperature → thermic effect on metabolism
 * - D5 (Scoring): nutrition quality feeds metabolic sub-score
 */
export interface MealLog extends TimestampedEntity {
  readonly id: MealLogId;
  readonly user_id: UserId;
  readonly logged_at: ISODateTime;
  readonly meal_type: MealType;
  readonly items: MealItem[];
  readonly total_calories: number | null; // computed
  readonly notes: string | null;
  readonly photo_path: string | null; // optional meal photo

  /**
   * AI-computed meal quality score (0–100).
   * Factors: GI load, protein/fiber ratio, micronutrient density,
   * food combination synergies/conflicts.
   */
  readonly meal_quality_score: number | null;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drink";

/** An individual food within a meal, with portion size. */
export interface MealItem {
  readonly food_item_id: BigIntId;
  readonly food_name: string;          // denormalized for quick display
  readonly portion_grams: number;
  readonly calories: number | null;    // computed from portion
}

/**
 * Continuous Glucose Monitor (CGM) time-series data point.
 * Captured every 1–15 minutes from devices like FreeStyle Libre, Dexcom.
 *
 * AI QUERY PATH: The engine uses CGM data to:
 *   1. Detect post-meal glucose spikes (join with MealLog by timestamp)
 *   2. Calculate Time in Range (TIR) — percentage within 70–140 mg/dL
 *   3. Identify dawn phenomenon (early morning spikes)
 *   4. Correlate glucose variability with sleep quality (D4)
 *
 * CROSS-DOMAIN LINKS:
 * - D3 (MealLog): CGM spike (T + 30–90min after meal_logged_at)
 * - D4 (Sleep): poor deep sleep → morning glucose dysregulation
 * - D2 (Genetics): TCF7L2 variant → predisposition to glucose spikes
 * - D2 (Medications): metformin → flattened post-meal curves
 *
 * EXAMPLE AI REASONING:
 *   "Your glucose spiked to 11.2 mmol/L at 08:45 — 40 minutes after
 *    your breakfast of white rice + orange juice. Yesterday, oatmeal +
 *    eggs caused no spike. Consider pairing carbs with protein/fat."
 */
export interface CgmReading extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly device_id: string | null;    // e.g. "libre3_abc123"
  readonly recorded_at: ISODateTime;

  /** Glucose in mmol/L (primary unit). */
  readonly glucose_mmol: number;
  /** Glucose in mg/dL (convenience, = mmol × 18.018). */
  readonly glucose_mgdl: number;

  /** Rate of change in mmol/L per minute (positive = rising). */
  readonly rate_of_change: number | null;
  /** Device-reported trend direction. */
  readonly trend: GlucoseTrend | null;

  /** Whether this reading was during a fasting window. */
  readonly is_fasting: boolean;
}

export type GlucoseTrend =
  | "rising_rapidly" | "rising" | "stable"
  | "falling" | "falling_rapidly";

/**
 * User-reported gut/digestive symptom log.
 * Designed for temporal correlation with meals (1–6h post-meal).
 *
 * AI QUERY PATH: The engine finds patterns like:
 *   "You reported bloating 3 out of 4 times you ate dairy this week.
 *    Given your MCM6 genetic variant (lactose intolerance risk),
 *    consider reducing dairy or using lactase supplements."
 *
 * CROSS-DOMAIN LINKS:
 * - D3 (MealLog): symptom timestamp - meal timestamp = onset delay
 * - D2 (Genetics): MCM6/HLA variants → food sensitivity prediction
 * - D2 (Medications): PPIs → altered gut pH → nutrient absorption
 * - D5 (Scoring): frequent gut symptoms → lower digestive sub-score
 */
export interface GutSymptomLog extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly logged_at: ISODateTime;
  readonly symptoms: GutSymptom[];
  readonly severity: 1 | 2 | 3 | 4 | 5; // 1 = mild, 5 = severe
  readonly onset_delay_minutes: number | null; // minutes since last meal
  readonly linked_meal_id: MealLogId | null;   // manual or auto-linked
  readonly bristol_scale: BristolScale | null;  // stool form
  readonly notes: string | null;
}

export type GutSymptom =
  | "bloating" | "gas" | "cramps" | "nausea" | "diarrhea"
  | "constipation" | "acid_reflux" | "brain_fog" | "fatigue"
  | "headache" | "skin_reaction" | "joint_pain";

/** Bristol Stool Scale: 1 (hard lumps) → 7 (liquid). */
export type BristolScale = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// ════════════════════════════════════════════════════════════════════════
// §4  DOMAIN 4 — RECOVERY & WEARABLES
// ════════════════════════════════════════════════════════════════════════

/**
 * A single night's sleep session.
 * Sourced from Oura Ring, Whoop, Apple Watch, Garmin, etc.
 *
 * AI QUERY PATH: Sleep architecture directly influences:
 *   1. Next-day glucose response (poor deep sleep → insulin resistance)
 *   2. Cortisol rhythm (disrupted sleep → elevated morning cortisol)
 *   3. Recovery capacity (low REM → cognitive sub-score drops)
 *   4. Inflammation (chronically poor sleep → elevated CRP)
 *
 * CROSS-DOMAIN LINKS:
 * - D3 (CGM): poor deep sleep → morning glucose spike correlation
 * - D2 (Bio-Data): chronic sleep debt → elevated inflammatory markers
 * - D1 (Environment): high AQI/temperature → disrupted sleep stages
 * - D2 (Medications): melatonin → improved deep sleep %
 * - D5 (Scoring): sleep quality feeds recovery sub-score
 *
 * EXAMPLE AI REASONING:
 *   "You've averaged 42 minutes of deep sleep this week (vs 90 target).
 *    Your fasting glucose has risen 0.8 mmol/L. Research shows that
 *    insufficient deep sleep impairs insulin sensitivity by up to 30%.
 *    Your bedroom temperature averaged 26°C — try lowering to 18–19°C."
 */
export interface SleepSession extends TimestampedEntity {
  readonly id: SleepSessionId;
  readonly user_id: UserId;
  readonly device_source: WearableSource;

  readonly sleep_start: ISODateTime;
  readonly sleep_end: ISODateTime;
  readonly total_duration_minutes: number;

  // ── Sleep Architecture ─────────────────────────────────────────
  readonly deep_sleep_minutes: number;
  readonly rem_sleep_minutes: number;
  readonly light_sleep_minutes: number;
  readonly awake_minutes: number;

  // ── Quality Metrics ────────────────────────────────────────────
  /** Percentage of time in bed actually asleep (0–100). */
  readonly sleep_efficiency: number | null;
  /** Number of times woken during the night. */
  readonly awakenings_count: number | null;
  /** Latency to fall asleep in minutes. */
  readonly sleep_onset_latency_minutes: number | null;
  /** Device-reported overall score (0–100 normalized). */
  readonly device_score: number | null;

  // ── Context ────────────────────────────────────────────────────
  /** Bedroom temperature if available from device/sensor. */
  readonly room_temperature_celsius: number | null;

  /** Individual sleep stages — detailed breakdown. */
  readonly stages: SleepStage[];
}

export type WearableSource = "oura" | "whoop" | "apple_watch" | "garmin" | "fitbit" | "samsung" | "manual" | "other";

/**
 * An individual sleep stage period within a SleepSession.
 * Enables fine-grained analysis of sleep architecture.
 */
export interface SleepStage {
  readonly stage: SleepStageType;
  readonly start: ISODateTime;
  readonly end: ISODateTime;
  readonly duration_minutes: number;
}

export type SleepStageType = "deep" | "rem" | "light" | "awake";

/**
 * Heart Rate Variability (HRV) reading.
 * Typically captured during sleep or morning spot-check.
 *
 * AI QUERY PATH: HRV is the master recovery indicator. The engine uses it to:
 *   1. Assess autonomic nervous system balance (sympathetic vs parasympathetic)
 *   2. Detect early overtraining or illness onset (HRV drop > 15% from baseline)
 *   3. Correlate with stress levels, sleep quality, and biomarker inflammation
 *   4. Modify exercise recommendations (low HRV → suggest rest day)
 *
 * CROSS-DOMAIN LINKS:
 * - D4 (Sleep): HRV during deep sleep = most reliable baseline
 * - D2 (Bio-Data): chronically low HRV → check cortisol, CRP
 * - D2 (Medications): beta-blockers artificially lower HR, affect HRV
 * - D1 (Environment): extreme heat → sympathetic dominance → lower HRV
 * - D5 (Scoring): 7-day HRV trend feeds recovery sub-score
 */
export interface HrvReading extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly device_source: WearableSource;
  readonly recorded_at: ISODateTime;

  /** RMSSD in milliseconds — primary HRV metric. */
  readonly rmssd_ms: number;
  /** SDNN in milliseconds — overall HRV variability. */
  readonly sdnn_ms: number | null;
  /** Resting heart rate in bpm. */
  readonly resting_hr_bpm: number | null;
  /** High-frequency power (ms²) — parasympathetic indicator. */
  readonly hf_power: number | null;
  /** Low-frequency power (ms²) — mix of sympathetic/parasympathetic. */
  readonly lf_power: number | null;

  /** Context for when this was measured. */
  readonly measurement_context: "sleep" | "morning" | "post_exercise" | "spot_check";
}

/**
 * Morning readiness score — computed from sleep + HRV + other signals.
 * Typically generated once per day.
 *
 * AI QUERY PATH: Readiness score determines:
 *   - Whether to recommend intense exercise or active recovery
 *   - Food sensitivity testing windows (high readiness = better baseline)
 *   - Optimal timing for blood draws (rested state)
 *
 * CROSS-DOMAIN LINKS:
 * - D4 (Sleep + HRV): primary inputs
 * - D2 (Bio-Data): readiness trends correlate with inflammatory markers
 * - D3 (Metabolic): readiness affects glucose sensitivity
 * - D5 (Scoring): feeds directly into daily HealthspanScore
 */
export interface ReadinessScore extends TimestampedEntity {
  readonly id: BigIntId;
  readonly user_id: UserId;
  readonly date: string; // ISO date — one per day
  readonly device_source: WearableSource;

  /** Overall readiness (0–100). */
  readonly score: number;

  /** Component breakdown. */
  readonly components: {
    readonly sleep_quality: number;      // 0–100
    readonly hrv_balance: number;        // 0–100
    readonly recovery_index: number;     // 0–100
    readonly resting_hr_deviation: number; // % deviation from baseline
    readonly body_temperature_deviation: number | null; // °C from baseline
  };

  readonly recommendation: "peak_performance" | "normal_activity" | "light_activity" | "rest_day";
}

// ════════════════════════════════════════════════════════════════════════
// §5  DOMAIN 5 — AI SCORING ENGINE
// ════════════════════════════════════════════════════════════════════════

/**
 * The master "Biological Age" or "Healthspan Score" record.
 * Calculated periodically (daily/weekly) by the AI engine, synthesizing
 * data from all 4 input domains.
 *
 * The score answers: "How is your health trajectory compared to optimal?"
 *
 * AI COMPUTATION MODEL:
 *   HealthspanScore = Σ (weight_i × normalized_factor_i)
 *
 * Where factors come from:
 *   - Biomarker trajectory (D2): are markers improving or declining?
 *   - Metabolic fitness (D3): CGM time-in-range, meal quality trends
 *   - Recovery capacity (D4): sleep efficiency, HRV baseline trend
 *   - Environmental load (D1): chronic pollution/stress exposure
 *   - Genetic ceiling (D2): risk-adjusted upper bound
 *
 * EXAMPLE AI REASONING:
 *   "Your biological age decreased from 38.2 → 36.8 over 3 months.
 *    Top contributors: improved Vitamin D (+15 units, now optimal),
 *    better sleep consistency (efficiency 88% → 93%), and CGM
 *    time-in-range increased from 72% → 85% after reducing late
 *    evening carbs."
 */
export interface HealthspanScore extends TimestampedEntity {
  readonly id: HealthspanScoreId;
  readonly user_id: UserId;
  readonly computed_at: ISODateTime;
  readonly computation_version: string; // e.g. "v2.1" — model versioning

  // ── Headline Scores ────────────────────────────────────────────
  /** Overall healthspan score (0–100, higher = better). */
  readonly overall_score: number;
  /** Estimated biological age in years. */
  readonly biological_age: number;
  /** Chronological age at time of computation. */
  readonly chronological_age: number;
  /** Delta from previous computation (positive = improvement). */
  readonly score_delta: number | null;

  // ── Sub-Scores (0–100 each) ────────────────────────────────────
  readonly sub_scores: {
    /** Based on biomarker positions relative to dynamic norms. */
    readonly biomarker_health: number;
    /** Based on CGM TIR, meal quality, macro balance. */
    readonly metabolic_fitness: number;
    /** Based on sleep architecture, HRV trends, readiness. */
    readonly recovery_capacity: number;
    /** Based on gut symptom frequency, digestive regularity. */
    readonly gut_health: number;
    /** Based on AQI exposure, stress level, hydration. */
    readonly environmental_resilience: number;
    /** Based on genetic risk factors (this is a ceiling modifier). */
    readonly genetic_ceiling: number;
  };

  /** The individual factors that composed this score. */
  readonly factors: ScoreFactor[];
}

/**
 * A single factor that contributed to a HealthspanScore computation.
 * Provides explainability — the user can see WHY their score changed.
 */
export interface ScoreFactor {
  readonly domain: "bio_data" | "metabolic" | "recovery" | "environment" | "genetics";
  readonly metric_name: string;   // e.g. "vitamin_d_level", "cgm_time_in_range"
  readonly metric_value: number;  // actual measured value
  readonly metric_unit: string;   // e.g. "ng/mL", "%"
  readonly optimal_range: { readonly low: number; readonly high: number } | null;
  readonly weight: number;        // contribution weight (0–1)
  readonly impact: "positive" | "neutral" | "negative";
  readonly impact_magnitude: number; // how much this factor moved the score
}

/**
 * AI-generated insight or recommendation based on cross-domain analysis.
 * These are the actionable outputs the user sees.
 *
 * AI GENERATION TRIGGERS:
 *   - New biomarker results uploaded → compare with last session
 *   - Sleep quality drops 3+ consecutive days → proactive alert
 *   - CGM pattern detected (e.g., repeated post-meal spikes)
 *   - Medication interaction detected
 *   - Score sub-component crosses threshold
 *
 * EXAMPLE INSIGHTS:
 *   "Your deep sleep dropped 35% this week. Your CGM shows morning
 *    glucose 1.2 mmol/L higher than your 30-day baseline. Consider:
 *    (1) lowering bedroom temperature, (2) avoiding screens 1h before
 *    bed, (3) last meal 3h before sleep."
 */
export interface AiInsight extends TimestampedEntity {
  readonly id: InsightId;
  readonly user_id: UserId;
  readonly generated_at: ISODateTime;
  readonly trigger_event: InsightTrigger;

  /** Human-readable title. */
  readonly title: string;
  /** Detailed explanation with data citations. */
  readonly body: string;

  /** Which domains contributed data to this insight. */
  readonly source_domains: Array<"bio_data" | "metabolic" | "recovery" | "environment" | "genetics">;
  /** Related entity IDs for deep linking. */
  readonly related_entities: RelatedEntity[];

  readonly priority: "critical" | "high" | "medium" | "low";
  readonly category: InsightCategory;

  /** Whether the user has read/dismissed this insight. */
  readonly is_read: boolean;
  readonly is_actionable: boolean;

  /** Optional structured action items. */
  readonly action_items: ActionItem[] | null;
}

export type InsightTrigger =
  | "new_lab_results" | "sleep_quality_drop" | "cgm_pattern_detected"
  | "medication_interaction" | "score_threshold_crossed"
  | "environmental_alert" | "periodic_review" | "user_requested";

export type InsightCategory =
  | "nutrition" | "sleep" | "exercise" | "supplementation"
  | "medication_review" | "biomarker_trend" | "gut_health"
  | "environmental" | "general_wellness";

export interface ActionItem {
  readonly text: string;
  readonly is_completed: boolean;
  readonly due_date: string | null; // ISO date
}

export interface RelatedEntity {
  readonly entity_type: "test_result" | "meal_log" | "sleep_session" | "cgm_reading" | "medication" | "healthspan_score";
  readonly entity_id: BigIntId | MealLogId | SleepSessionId | HealthspanScoreId;
}

// ════════════════════════════════════════════════════════════════════════
// §6  AGGREGATED INDEX TYPE — Full User Health Graph
// ════════════════════════════════════════════════════════════════════════

/**
 * The complete user health graph — assembled by the AI engine
 * for holistic analysis. This is the "Knowledge Core" query result.
 *
 * Not stored as a single entity; this is a runtime aggregate
 * constructed from all 5 domains for a given user + time window.
 *
 * Usage: `const graph = await buildHealthGraph(userId, dateRange)`
 */
export interface UserHealthGraph {
  readonly user: UserProfile;
  readonly environment: {
    readonly readings: EnvironmentReading[];
    readonly water_quality: WaterQualitySnapshot[];
  };
  readonly bio_data: {
    readonly biomarkers: Biomarker[];
    readonly test_sessions: TestSession[];
    readonly test_results: TestResult[];
    readonly dynamic_norms: UserDynamicNorm[];
    readonly genetic_variants: GeneticVariant[];
    readonly medications: Medication[];
    readonly interaction_alerts: InteractionAlert[];
  };
  readonly metabolic: {
    readonly meal_logs: MealLog[];
    readonly cgm_readings: CgmReading[];
    readonly gut_symptoms: GutSymptomLog[];
  };
  readonly recovery: {
    readonly sleep_sessions: SleepSession[];
    readonly hrv_readings: HrvReading[];
    readonly readiness_scores: ReadinessScore[];
  };
  readonly scoring: {
    readonly scores: HealthspanScore[];
    readonly insights: AiInsight[];
  };
}
