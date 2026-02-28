/**
 * Wearable device metric types for the Wearables Hub tab.
 *
 * These interfaces define the structure for mocked frontend state.
 * Each category maps to a DeviceWidgetCard in the profile sheet.
 */

/** Generic metric tuple used by DeviceWidgetCard for rendering rows. */
export interface MetricItem {
  label: string;
  value: string | number | null;
  unit: string;
}

/** Field definition for ManualEntryDialog form generation. */
export interface MetricFieldDefinition {
  key: string;
  label: string;
  unit: string;
  type: "number" | "text";
  placeholder?: string;
  step?: string;
}

// ── Card 1: Sleep & Recovery ───────────────────────────────────────

export interface SleepRecoveryMetrics {
  sleepDurationHours: number | null;
  deepSleepPercent: number | null;
  remSleepPercent: number | null;
  readinessScore: number | null;
  hrvMs: number | null;
  respiratoryRateBrpm: number | null;
}

// ── Card 2: Cardio & Activity ──────────────────────────────────────

export interface CardioActivityMetrics {
  restingHeartRateBpm: number | null;
  vo2MaxMlKgMin: number | null;
  steps: number | null;
  stepsGoal: number | null;
  activeCaloriesKcal: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
}

// ── Card 3: Body Composition ───────────────────────────────────────

export interface BodyCompositionMetrics {
  weightKg: number | null;
  bodyFatPercent: number | null;
  muscleMassPercent: number | null;
  bmrKcal: number | null;
  visceralFatIndex: number | null;
}

// ── Card 4: Metabolic (CGM / Blood) ────────────────────────────────

export interface MetabolicMetrics {
  glucoseMmol: number | null;
  timeInRangePercent: number | null;
  glucoseVariabilityPercent: number | null;
}

// ── Card 5: Stress & Female Health ─────────────────────────────────

export interface StressFemaleHealthMetrics {
  stressScore: number | null;
  bodyTemperatureVariationC: number | null;
  spo2Percent: number | null;
}

// ── Aggregate ──────────────────────────────────────────────────────

export interface WearableMetrics {
  sleepRecovery: SleepRecoveryMetrics;
  cardioActivity: CardioActivityMetrics;
  bodyComposition: BodyCompositionMetrics;
  metabolic: MetabolicMetrics;
  stressFemaleHealth: StressFemaleHealthMetrics;
}

/** Default empty state for all wearable metrics. */
export const DEFAULT_WEARABLE_METRICS: WearableMetrics = {
  sleepRecovery: {
    sleepDurationHours: null,
    deepSleepPercent: null,
    remSleepPercent: null,
    readinessScore: null,
    hrvMs: null,
    respiratoryRateBrpm: null,
  },
  cardioActivity: {
    restingHeartRateBpm: null,
    vo2MaxMlKgMin: null,
    steps: null,
    stepsGoal: null,
    activeCaloriesKcal: null,
    bloodPressureSystolic: null,
    bloodPressureDiastolic: null,
  },
  bodyComposition: {
    weightKg: null,
    bodyFatPercent: null,
    muscleMassPercent: null,
    bmrKcal: null,
    visceralFatIndex: null,
  },
  metabolic: {
    glucoseMmol: null,
    timeInRangePercent: null,
    glucoseVariabilityPercent: null,
  },
  stressFemaleHealth: {
    stressScore: null,
    bodyTemperatureVariationC: null,
    spo2Percent: null,
  },
};
