import type { MetricFieldDefinition } from "@/types/wearable-types";

// t is expected to be useTranslations('wearables')

export const getSleepFields = (t: any): MetricFieldDefinition[] => [
    { key: "sleepDurationHours", label: t("sleepDuration"), unit: "ч", type: "number", step: "0.1", placeholder: "7.5" },
    { key: "deepSleepPercent", label: t("deepSleep"), unit: "%", type: "number", step: "1", placeholder: "20" },
    { key: "remSleepPercent", label: t("remSleep"), unit: "%", type: "number", step: "1", placeholder: "22" },
    { key: "readinessScore", label: t("readinessIndex"), unit: "0-100", type: "number", step: "1", placeholder: "82" },
    { key: "hrvMs", label: t("hrv"), unit: "мс", type: "number", step: "1", placeholder: "45" },
    { key: "respiratoryRateBrpm", label: t("respiratoryRate"), unit: "вд/мин", type: "number", step: "0.1", placeholder: "15" },
];

export const getCardioFields = (t: any): MetricFieldDefinition[] => [
    { key: "restingHeartRateBpm", label: t("restingHR"), unit: "уд/мин", type: "number", step: "1", placeholder: "62" },
    { key: "vo2MaxMlKgMin", label: t("vo2max"), unit: "мл/кг/мин", type: "number", step: "0.1", placeholder: "42.5" },
    { key: "steps", label: t("steps"), unit: "шагов", type: "number", step: "1", placeholder: "8500" },
    { key: "activeCaloriesKcal", label: t("activeCalories"), unit: "ккал", type: "number", step: "1", placeholder: "420" },
    { key: "bloodPressureSystolic", label: t("bloodPressureSystolic"), unit: "мм рт.ст.", type: "number", step: "1", placeholder: "120" },
    { key: "bloodPressureDiastolic", label: t("bloodPressureDiastolic"), unit: "мм рт.ст.", type: "number", step: "1", placeholder: "80" },
];

export const getBodyFields = (t: any): MetricFieldDefinition[] => [
    { key: "weightKg", label: t("weightLabel"), unit: "кг", type: "number", step: "0.1", placeholder: "72.5" },
    { key: "bodyFatPercent", label: t("bodyFat"), unit: "%", type: "number", step: "0.1", placeholder: "18.5" },
    { key: "muscleMassPercent", label: t("muscleMass"), unit: "%", type: "number", step: "0.1", placeholder: "42" },
    { key: "bmrKcal", label: t("basalMetabolism"), unit: "ккал", type: "number", step: "1", placeholder: "1680" },
    { key: "visceralFatIndex", label: t("visceralFat"), unit: "индекс", type: "number", step: "1", placeholder: "8" },
];

export const getMetabolicFields = (t: any): MetricFieldDefinition[] => [
    { key: "glucoseMmol", label: t("glucose"), unit: "ммоль/л", type: "number", step: "0.1", placeholder: "5.2" },
    { key: "timeInRangePercent", label: t("timeInRange"), unit: "%", type: "number", step: "1", placeholder: "85" },
    { key: "glucoseVariabilityPercent", label: t("glucoseVariability"), unit: "%", type: "number", step: "0.1", placeholder: "18" },
];

export const getStressFields = (t: any): MetricFieldDefinition[] => [
    { key: "stressScore", label: t("stressScore"), unit: "0-100", type: "number", step: "1", placeholder: "35" },
    { key: "bodyTemperatureVariationC", label: t("tempVariation"), unit: "°C", type: "number", step: "0.01", placeholder: "0.15" },
    { key: "spo2Percent", label: t("spo2"), unit: "%", type: "number", step: "0.1", placeholder: "97.5" },
];
