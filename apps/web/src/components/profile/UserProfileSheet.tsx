"use client";

import { useState, useEffect, useCallback } from "react";
import {
    User,
    X,
    Activity,
    Watch,
    Leaf,
    Plus,
    Moon,
    Heart,
    Scale,
    Droplets,
    Brain,
    AlertTriangle,
    Trash2,
    MapPin,
} from "lucide-react";

const COMMON_TIMEZONES = [
    "UTC",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Europe/Kyiv", "Europe/Istanbul",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
    "Asia/Dubai", "Asia/Almaty", "Asia/Tashkent", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore",
    "Australia/Sydney", "Australia/Perth", "Pacific/Auckland"
];

import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import DeviceWidgetCard from "./DeviceWidgetCard";
import ManualEntryDialog from "./ManualEntryDialog";
import type {
    MetricItem,
    MetricFieldDefinition,
    WearableMetrics,
} from "@/types/wearable-types";
import { DEFAULT_WEARABLE_METRICS } from "@/types/wearable-types";

// ── Field definitions for each wearable card's manual entry dialog ──

const SLEEP_FIELDS: MetricFieldDefinition[] = [
    { key: "sleepDurationHours", label: "Длительность сна", unit: "ч", type: "number", step: "0.1", placeholder: "7.5" },
    { key: "deepSleepPercent", label: "Глубокий сон", unit: "%", type: "number", step: "1", placeholder: "20" },
    { key: "remSleepPercent", label: "Быстрый сон (REM)", unit: "%", type: "number", step: "1", placeholder: "22" },
    { key: "readinessScore", label: "Индекс готовности", unit: "0-100", type: "number", step: "1", placeholder: "82" },
    { key: "hrvMs", label: "HRV (во сне)", unit: "мс", type: "number", step: "1", placeholder: "45" },
    { key: "respiratoryRateBrpm", label: "Частота дыхания", unit: "вд/мин", type: "number", step: "0.1", placeholder: "15" },
];

const CARDIO_FIELDS: MetricFieldDefinition[] = [
    { key: "restingHeartRateBpm", label: "Пульс покоя (RHR)", unit: "уд/мин", type: "number", step: "1", placeholder: "62" },
    { key: "vo2MaxMlKgMin", label: "VO2 Max", unit: "мл/кг/мин", type: "number", step: "0.1", placeholder: "42.5" },
    { key: "steps", label: "Шаги", unit: "шагов", type: "number", step: "1", placeholder: "8500" },
    { key: "activeCaloriesKcal", label: "Активные калории", unit: "ккал", type: "number", step: "1", placeholder: "420" },
    { key: "bloodPressureSystolic", label: "АД систолическое", unit: "мм рт.ст.", type: "number", step: "1", placeholder: "120" },
    { key: "bloodPressureDiastolic", label: "АД диастолическое", unit: "мм рт.ст.", type: "number", step: "1", placeholder: "80" },
];

const BODY_FIELDS: MetricFieldDefinition[] = [
    { key: "weightKg", label: "Вес", unit: "кг", type: "number", step: "0.1", placeholder: "72.5" },
    { key: "bodyFatPercent", label: "Процент жира", unit: "%", type: "number", step: "0.1", placeholder: "18.5" },
    { key: "muscleMassPercent", label: "Мышечная масса", unit: "%", type: "number", step: "0.1", placeholder: "42" },
    { key: "bmrKcal", label: "Базальный метаболизм", unit: "ккал", type: "number", step: "1", placeholder: "1680" },
    { key: "visceralFatIndex", label: "Висцеральный жир", unit: "индекс", type: "number", step: "1", placeholder: "8" },
];

const METABOLIC_FIELDS: MetricFieldDefinition[] = [
    { key: "glucoseMmol", label: "Глюкоза", unit: "ммоль/л", type: "number", step: "0.1", placeholder: "5.2" },
    { key: "timeInRangePercent", label: "Время в целев. диапазоне (TIR)", unit: "%", type: "number", step: "1", placeholder: "85" },
    { key: "glucoseVariabilityPercent", label: "Вариабельность глюкозы", unit: "%", type: "number", step: "0.1", placeholder: "18" },
];

const STRESS_FIELDS: MetricFieldDefinition[] = [
    { key: "stressScore", label: "Уровень стресса", unit: "0-100", type: "number", step: "1", placeholder: "35" },
    { key: "bodyTemperatureVariationC", label: "Отклонение температуры", unit: "°C", type: "number", step: "0.01", placeholder: "0.15" },
    { key: "spo2Percent", label: "Кислород в крови (SpO2)", unit: "%", type: "number", step: "0.1", placeholder: "97.5" },
];

// ── Card category type for tracking which dialog is open ──

type WearableCardCategory =
    | "sleep"
    | "cardio"
    | "body"
    | "metabolic"
    | "stress"
    | null;

// ── Helper: converts a category object to MetricItem array ──

function toMetricItems(
    entries: [string, string, string][],
    data: Record<string, unknown>,
): MetricItem[] {
    return entries.map(([key, label, unit]) => ({
        label,
        value: (data[key] as string | number | null) ?? null,
        unit,
    }));
}

// ── Props ──

interface UserProfileSheetProps {
    userId: string;
    userEmail: string;
}

// ════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════

export default function UserProfileSheet({
    userId,
    userEmail,
}: UserProfileSheetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // ── Profile data ──
    const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // ── Tag inputs ──
    const [conditionInput, setConditionInput] = useState("");
    const [medicationInput, setMedicationInput] = useState("");

    // ── Wearable metrics (mocked — frontend only) ──
    const [wearableMetrics, setWearableMetrics] =
        useState<WearableMetrics>(DEFAULT_WEARABLE_METRICS);
    const [activeManualEntry, setActiveManualEntry] =
        useState<WearableCardCategory>(null);

    const [showDropdown, setShowDropdown] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDeleteAccount = async () => {
        try {
            setIsDeleting(true);
            await apiClient.deleteAccount();

            // Explicitly sign out from Supabase to clear cookies/session
            const supabase = createClient();
            await supabase.auth.signOut();

            // Clear all local data
            localStorage.clear();
            sessionStorage.clear();

            // Force redirect to landing page
            window.location.href = "/";
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Deletion failed";
            console.error("[DeleteAccount] Critical error:", err);
            setError(message);
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // ── Form state ──
    const [formData, setFormData] = useState<Record<string, unknown>>({
        display_name: "",
        ai_name: "",
        date_of_birth: "",
        biological_sex: "",
        weight_kg: "",
        height_cm: "",
        activity_level: "sedentary",
        diet_type: "omnivore",
        stress_level: "low",
        climate_zone: "temperate",
        sun_exposure: "moderate",
        alcohol_frequency: "none",
        work_lifestyle: "office_sedentary",
        physical_activity_minutes_weekly: "",
        sleep_hours_avg: "",
        is_smoker: false,
        pregnancy_status: "not_applicable",
        chronic_conditions: [] as string[],
        medications: [] as string[],
        city: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    });

    // ── Load profile on panel open ──

    useEffect(() => {
        if (isOpen && !profile) {
            loadProfile();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadProfile = async () => {
        setLoadingProfile(true);
        setError(null);
        try {
            const data = await apiClient.getProfile(userId);
            setProfile(data);
            setFormData({
                display_name: data.display_name ?? "",
                ai_name: data.ai_name ?? "",
                date_of_birth: data.date_of_birth
                    ? new Date(data.date_of_birth as string).toISOString().split("T")[0]
                    : "",
                biological_sex: data.biological_sex ?? "",
                weight_kg: data.weight_kg ?? "",
                height_cm: data.height_cm ?? "",
                activity_level: data.activity_level ?? "sedentary",
                diet_type: data.diet_type ?? "omnivore",
                stress_level: data.stress_level ?? "low",
                climate_zone: data.climate_zone ?? "temperate",
                sun_exposure: data.sun_exposure ?? "moderate",
                alcohol_frequency: data.alcohol_frequency ?? "none",
                work_lifestyle: data.work_lifestyle ?? "office_sedentary",
                physical_activity_minutes_weekly:
                    data.physical_activity_minutes_weekly ?? "",
                sleep_hours_avg: data.sleep_hours_avg ?? "",
                is_smoker: data.is_smoker ?? false,
                pregnancy_status: data.pregnancy_status ?? "not_applicable",
                chronic_conditions: Array.isArray(data.chronic_conditions)
                    ? data.chronic_conditions
                    : [],
                medications: Array.isArray(data.medications) ? data.medications : [],
                city: data.city ?? "",
                timezone:
                    data.timezone ??
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            if (message.includes("404")) {
                setProfile(null);
            } else {
                setError(message);
            }
        } finally {
            setLoadingProfile(false);
        }
    };

    // ── Save ──

    const handleSaveProfile = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSaveSuccess(false);
        try {
            const payload = {
                ...formData,
                ai_name: formData.ai_name || null,
                weight_kg: formData.weight_kg
                    ? parseFloat(String(formData.weight_kg))
                    : null,
                height_cm: formData.height_cm
                    ? parseFloat(String(formData.height_cm))
                    : null,
                physical_activity_minutes_weekly:
                    formData.physical_activity_minutes_weekly
                        ? parseInt(String(formData.physical_activity_minutes_weekly), 10)
                        : null,
                sleep_hours_avg: formData.sleep_hours_avg
                    ? parseFloat(String(formData.sleep_hours_avg))
                    : null,
                date_of_birth: formData.date_of_birth || null,
                biological_sex: formData.biological_sex || null,
            };

            // 1. Сохраняем и получаем актуальные данные от сервера
            const updatedData = await apiClient.updateProfile(userId, payload);

            // 2. Обновляем локальный стейт НАПРЯМУЮ, без вызова loadProfile()
            setProfile(updatedData);
            setFormData(prev => ({
                ...prev,
                ...updatedData,
                ai_name: updatedData.ai_name ?? "",
                date_of_birth: updatedData.date_of_birth
                    ? new Date(updatedData.date_of_birth as string).toISOString().split("T")[0]
                    : "",
            }));

            // 3. Показываем успех
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

            // 4. Notify other components (e.g. FoodDiaryView) to re-fetch norms
            window.dispatchEvent(new CustomEvent("profile-updated"));
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            setError(message);
        } finally {
            setIsSaving(false);
        }
    };

    // ── BMI ──

    const bmi =
        formData.weight_kg && formData.height_cm
            ? (
                parseFloat(String(formData.weight_kg)) /
                Math.pow(parseFloat(String(formData.height_cm)) / 100, 2)
            ).toFixed(1)
            : null;

    const bmiCategory = (v: number): string => {
        if (v < 18.5) return "Дефицит";
        if (v < 25) return "Норма";
        if (v < 30) return "Избыток";
        return "Ожирение";
    };

    // ── Tag helpers ──

    const conditions = formData.chronic_conditions as string[];
    const meds = formData.medications as string[];

    const addCondition = () => {
        if (!conditionInput.trim()) return;
        setFormData((prev) => ({
            ...prev,
            chronic_conditions: [
                ...(prev.chronic_conditions as string[]),
                conditionInput.trim(),
            ],
        }));
        setConditionInput("");
    };

    const removeCondition = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            chronic_conditions: (prev.chronic_conditions as string[]).filter(
                (_, i) => i !== index,
            ),
        }));
    };

    const addMedication = () => {
        if (!medicationInput.trim()) return;
        setFormData((prev) => ({
            ...prev,
            medications: [
                ...(prev.medications as string[]),
                medicationInput.trim(),
            ],
        }));
        setMedicationInput("");
    };

    const removeMedication = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            medications: (prev.medications as string[]).filter(
                (_, i) => i !== index,
            ),
        }));
    };

    // ── Wearable manual entry handler ──

    const handleWearableSave = useCallback(
        (category: WearableCardCategory, values: Record<string, string>) => {
            if (!category) return;

            const parsed: Record<string, number | null> = {};
            for (const [key, val] of Object.entries(values)) {
                parsed[key] = val ? parseFloat(val) : null;
            }

            setWearableMetrics((prev) => {
                const categoryMap: Record<string, keyof WearableMetrics> = {
                    sleep: "sleepRecovery",
                    cardio: "cardioActivity",
                    body: "bodyComposition",
                    metabolic: "metabolic",
                    stress: "stressFemaleHealth",
                };
                const field = categoryMap[category];
                if (!field) return prev;

                return {
                    ...prev,
                    [field]: { ...prev[field], ...parsed },
                };
            });
        },
        [],
    );

    // ── Build MetricItem arrays for each card ──

    const sleepMetrics: MetricItem[] = toMetricItems(
        [
            ["sleepDurationHours", "Длительность сна", "ч"],
            ["deepSleepPercent", "Глубокий сон", "%"],
            ["remSleepPercent", "Быстрый сон (REM)", "%"],
            ["readinessScore", "Индекс готовности", ""],
            ["hrvMs", "HRV (во сне)", "мс"],
            ["respiratoryRateBrpm", "Частота дыхания", "вд/мин"],
        ],
        wearableMetrics.sleepRecovery as unknown as Record<string, unknown>,
    );

    const cardioMetrics: MetricItem[] = (() => {
        const ca = wearableMetrics.cardioActivity;
        const bpValue =
            ca.bloodPressureSystolic !== null && ca.bloodPressureDiastolic !== null
                ? `${ca.bloodPressureSystolic}/${ca.bloodPressureDiastolic}`
                : null;
        return [
            { label: "Пульс покоя (RHR)", value: ca.restingHeartRateBpm, unit: "уд/мин" },
            { label: "VO2 Max", value: ca.vo2MaxMlKgMin, unit: "мл/кг/мин" },
            {
                label: "Шаги",
                value:
                    ca.steps !== null
                        ? `${ca.steps}${ca.stepsGoal ? ` / ${ca.stepsGoal}` : ""}`
                        : null,
                unit: "",
            },
            { label: "Активные калории", value: ca.activeCaloriesKcal, unit: "ккал" },
            { label: "Артериальное давление", value: bpValue, unit: "мм рт.ст." },
        ];
    })();

    const bodyMetrics: MetricItem[] = toMetricItems(
        [
            ["weightKg", "Вес", "кг"],
            ["bodyFatPercent", "Процент жира", "%"],
            ["muscleMassPercent", "Мышечная масса", "%"],
            ["bmrKcal", "Базальный метаболизм", "ккал"],
            ["visceralFatIndex", "Висцеральный жир", "индекс"],
        ],
        wearableMetrics.bodyComposition as unknown as Record<string, unknown>,
    );

    const metabolicMetrics: MetricItem[] = toMetricItems(
        [
            ["glucoseMmol", "Глюкоза", "ммоль/л"],
            ["timeInRangePercent", "Время в целев. диапазоне", "%"],
            ["glucoseVariabilityPercent", "Вариабельность глюкозы", "%"],
        ],
        wearableMetrics.metabolic as unknown as Record<string, unknown>,
    );

    const stressMetrics: MetricItem[] = toMetricItems(
        [
            ["stressScore", "Уровень стресса", ""],
            ["bodyTemperatureVariationC", "Откл. температуры", "°C"],
            ["spo2Percent", "SpO2", "%"],
        ],
        wearableMetrics.stressFemaleHealth as unknown as Record<string, unknown>,
    );

    // ── Dialog field definitions by category ──

    const dialogConfig: Record<
        string,
        { title: string; fields: MetricFieldDefinition[] }
    > = {
        sleep: { title: "Сон и Восстановление", fields: SLEEP_FIELDS },
        cardio: { title: "Кардио и Активность", fields: CARDIO_FIELDS },
        body: { title: "Состав Тела", fields: BODY_FIELDS },
        metabolic: { title: "Метаболизм (CGM)", fields: METABOLIC_FIELDS },
        stress: { title: "Стресс и Здоровье", fields: STRESS_FIELDS },
    };

    // ── Render ──

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 hover:bg-surface-muted px-3 py-1.5 rounded-full transition-colors cursor-pointer"
            >
                <div className="bg-primary-100 p-1.5 rounded-full text-primary-600">
                    <User size={16} />
                </div>
                <span className="text-sm font-medium text-ink-main hidden sm:inline-block">
                    {userEmail.split("@")[0]}
                </span>
            </button>

            {/* Overlay */}
            {mounted && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Slide-out Sheet */}
            {mounted && (
                <div
                    className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-surface-base shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"
                        }`}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-white z-10 relative">
                        <div>
                            <h2 className="text-xl font-bold text-ink-main">Health Profile</h2>
                            <p className="text-sm text-ink-muted mt-0.5">{userEmail}</p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 text-ink-muted hover:text-ink-main hover:bg-surface-muted rounded-full transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto bg-surface-base">
                        {loadingProfile ? (
                            <div className="p-6 space-y-4 animate-pulse">
                                <div className="h-10 bg-surface-hover rounded-md w-full" />
                                <div className="h-32 bg-surface-hover rounded-xl w-full" />
                                <div className="h-32 bg-surface-hover rounded-xl w-full" />
                            </div>
                        ) : (
                            <div className="p-6">
                                {error && (
                                    <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium shadow-sm">
                                        {error}
                                    </div>
                                )}

                                <Tabs defaultValue="overview" className="w-full">
                                    <TabsList className="grid w-full grid-cols-4 mb-6">
                                        <TabsTrigger
                                            value="overview"
                                            className="flex items-center gap-1.5 text-xs cursor-pointer"
                                        >
                                            <User size={14} className="hidden sm:block" /> Overview
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="lifestyle"
                                            className="flex items-center gap-1.5 text-xs cursor-pointer"
                                        >
                                            <Leaf size={14} className="hidden sm:block" /> Lifestyle
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="medical"
                                            className="flex items-center gap-1.5 text-xs cursor-pointer"
                                        >
                                            <Activity size={14} className="hidden sm:block" /> Medical
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="wearables"
                                            className="flex items-center gap-1.5 text-xs cursor-pointer"
                                        >
                                            <Watch size={14} className="hidden sm:block" /> Devices
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ═══ TAB 1: OVERVIEW ═══ */}
                                    <TabsContent
                                        value="overview"
                                        className="space-y-6 focus:outline-none"
                                    >
                                        {/* Personal Info */}
                                        <div className="bg-white p-5 rounded-2xl border border-divider shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink-main border-b border-divider pb-3">
                                                Personal Info
                                            </h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label
                                                        htmlFor="display_name"
                                                        className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                    >
                                                        Имя
                                                    </label>
                                                    <input
                                                        id="display_name"
                                                        type="text"
                                                        value={String(formData.display_name ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, display_name: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Не указано"
                                                    />
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="ai_name"
                                                        className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                    >
                                                        Имя ИИ ассистента
                                                    </label>
                                                    <input
                                                        id="ai_name"
                                                        type="text"
                                                        value={String(formData.ai_name ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, ai_name: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Например: Maya Pro"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div>
                                                        <label
                                                            htmlFor="date_of_birth"
                                                            className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                        >
                                                            Дата рождения
                                                        </label>
                                                        <input
                                                            id="date_of_birth"
                                                            type="date"
                                                            value={String(formData.date_of_birth ?? "")}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    date_of_birth: e.target.value,
                                                                })
                                                            }
                                                            className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label
                                                            htmlFor="biological_sex"
                                                            className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                        >
                                                            Биологический пол
                                                        </label>
                                                        <select
                                                            id="biological_sex"
                                                            value={String(formData.biological_sex ?? "")}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    biological_sex: e.target.value,
                                                                })
                                                            }
                                                            className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                        >
                                                            <option value="">Не указано</option>
                                                            <option value="male">Мужской</option>
                                                            <option value="female">Женский</option>
                                                            <option value="other">Другое</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Physical Parameters */}
                                        <div className="bg-white p-5 rounded-2xl border border-divider shadow-sm space-y-4">
                                            <div className="flex items-center justify-between border-b border-divider pb-3">
                                                <h3 className="font-semibold text-ink-main">
                                                    Physical Parameters
                                                </h3>
                                                {bmi && (
                                                    <div className="px-2.5 py-1 text-xs font-bold rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                                                        BMI: {bmi} ({bmiCategory(parseFloat(bmi))})
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label
                                                        htmlFor="weight_kg"
                                                        className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                    >
                                                        Вес (кг)
                                                    </label>
                                                    <input
                                                        id="weight_kg"
                                                        type="number"
                                                        step="0.1"
                                                        value={String(formData.weight_kg ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, weight_kg: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Не указано"
                                                    />
                                                </div>
                                                <div>
                                                    <label
                                                        htmlFor="height_cm"
                                                        className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                    >
                                                        Рост (см)
                                                    </label>
                                                    <input
                                                        id="height_cm"
                                                        type="number"
                                                        value={String(formData.height_cm ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, height_cm: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Не указано"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label
                                                        htmlFor="city"
                                                        className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                    >
                                                        Город
                                                    </label>
                                                    <input
                                                        id="city"
                                                        type="text"
                                                        value={String(formData.city ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, city: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Не указано"
                                                    />
                                                </div>
                                                <div>
                                                    <label
                                                        htmlFor="timezone"
                                                        className="block text-[13px] font-semibold text-ink-main mb-1.5"
                                                    >
                                                        Часовой пояс
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="timezone"
                                                            type="text"
                                                            value={String(formData.timezone ?? "")}
                                                            onChange={(e) =>
                                                                setFormData({ ...formData, timezone: e.target.value })
                                                            }
                                                            onFocus={() => setShowDropdown(true)}
                                                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                                            className="w-full pl-3 pr-10 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                            placeholder="Поиск часового пояса..."
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                                                setFormData({ ...formData, timezone: tz });
                                                            }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                                                            title="Определить автоматически"
                                                        >
                                                            <MapPin size={16} />
                                                        </button>

                                                        {showDropdown && (
                                                            <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-60 overflow-y-auto rounded-xl border border-divider shadow-xl bg-surface-base/95 backdrop-blur-md py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                {COMMON_TIMEZONES.filter(tz => 
                                                                    !formData.timezone || 
                                                                    tz.toLowerCase().includes(String(formData.timezone).toLowerCase())
                                                                ).length > 0 ? (
                                                                    COMMON_TIMEZONES.filter(tz => 
                                                                        !formData.timezone || 
                                                                        tz.toLowerCase().includes(String(formData.timezone).toLowerCase())
                                                                    ).map((tz) => (
                                                                        <button
                                                                            key={tz}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setFormData({ ...formData, timezone: tz });
                                                                                setShowDropdown(false);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer flex items-center gap-2 group"
                                                                        >
                                                                            <span className="w-1 h-1 rounded-full bg-ink-muted group-hover:bg-primary-400" />
                                                                            {tz}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-3 py-2 text-xs text-ink-muted italic"> Ничего не найдено </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Danger Zone */}
                                        <div className="mt-8 pt-8 border-t-2 border-red-100 space-y-4">
                                            <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-tight">
                                                <AlertTriangle size={16} /> Опасная зона
                                            </h3>
                                            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm">
                                                <p className="text-[13px] text-red-700 leading-relaxed font-medium mb-4">
                                                    Удаление аккаунта приведет к безвозвратной потере всех ваших данных, включая анализы, историю чатов и настройки профиля.
                                                </p>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    className="w-full sm:w-auto px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    <Trash2 size={16} /> Удалить мой аккаунт и данные
                                                </button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ═══ TAB 2: LIFESTYLE ═══ */}
                                    <TabsContent
                                        value="lifestyle"
                                        className="space-y-6 focus:outline-none"
                                    >
                                        {/* Nutrition & Environment */}
                                        <div className="bg-white p-5 rounded-2xl border border-divider shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink-main border-b border-divider pb-3">
                                                Питание и Среда
                                            </h3>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Тип диеты
                                                    </label>
                                                    <select
                                                        value={String(formData.diet_type)}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, diet_type: e.target.value })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="omnivore">Omnivore</option>
                                                        <option value="vegetarian">Vegetarian</option>
                                                        <option value="vegan">Vegan</option>
                                                        <option value="pescatarian">Pescatarian</option>
                                                        <option value="keto">Keto</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Алкоголь
                                                    </label>
                                                    <select
                                                        value={String(formData.alcohol_frequency)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                alcohol_frequency: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="none">Не употребляю</option>
                                                        <option value="occasional">Иногда</option>
                                                        <option value="moderate">Умеренно</option>
                                                        <option value="heavy">Часто</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Климат
                                                    </label>
                                                    <select
                                                        value={String(formData.climate_zone)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                climate_zone: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="temperate">Умеренный</option>
                                                        <option value="tropical">Тропический</option>
                                                        <option value="dry">Сухой</option>
                                                        <option value="continental">Континентальный</option>
                                                        <option value="polar">Полярный</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Уровень солнца
                                                    </label>
                                                    <select
                                                        value={String(formData.sun_exposure)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                sun_exposure: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="minimal">Минимальный</option>
                                                        <option value="moderate">Умеренный</option>
                                                        <option value="high">Высокий</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Activity & Recovery */}
                                        <div className="bg-white p-5 rounded-2xl border border-divider shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink-main border-b border-divider pb-3">
                                                Активность и Восстановление
                                            </h3>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Уровень активности
                                                    </label>
                                                    <select
                                                        value={String(formData.activity_level)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                activity_level: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="sedentary">Сидячий</option>
                                                        <option value="light">Лёгкий</option>
                                                        <option value="moderate">Умеренный</option>
                                                        <option value="active">Активный</option>
                                                        <option value="very_active">Очень активный</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Тип работы
                                                    </label>
                                                    <select
                                                        value={String(formData.work_lifestyle)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                work_lifestyle: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="office_sedentary">Офис (сидячая)</option>
                                                        <option value="office_active">Офис (активная)</option>
                                                        <option value="remote_flexible">Удалёнка</option>
                                                        <option value="manual_labor">Физический труд</option>
                                                        <option value="shift_work">Сменная работа</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Кардио в нед. (мин)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={String(
                                                            formData.physical_activity_minutes_weekly ?? "",
                                                        )}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                physical_activity_minutes_weekly: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Не указано"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Среднее время сна (ч)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={String(formData.sleep_hours_avg ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                sleep_hours_avg: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                        placeholder="Не указано"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sleep & Stress */}
                                        <div className="bg-white p-5 rounded-2xl border border-divider shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink-main border-b border-divider pb-3">
                                                Сон и Стресс
                                            </h3>
                                            <div>
                                                <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                    Базовый уровень стресса
                                                </label>
                                                <select
                                                    value={String(formData.stress_level)}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            stress_level: e.target.value,
                                                        })
                                                    }
                                                    className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                >
                                                    <option value="low">Низкий</option>
                                                    <option value="moderate">Средний</option>
                                                    <option value="high">Высокий</option>
                                                    <option value="very_high">Очень высокий</option>
                                                </select>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ═══ TAB 3: MEDICAL CONTEXT ═══ */}
                                    <TabsContent
                                        value="medical"
                                        className="space-y-6 focus:outline-none"
                                    >
                                        <div className="bg-white p-5 rounded-2xl border border-divider shadow-sm space-y-5">
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="isSmoker"
                                                        checked={Boolean(formData.is_smoker)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                is_smoker: e.target.checked,
                                                            })
                                                        }
                                                        className="w-4 h-4 rounded border-divider text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <label
                                                        htmlFor="isSmoker"
                                                        className="text-[13px] font-semibold text-ink-main"
                                                    >
                                                        Курение / Вейпинг
                                                    </label>
                                                </div>
                                                <div>
                                                    <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                        Беременность
                                                    </label>
                                                    <select
                                                        value={String(formData.pregnancy_status)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                pregnancy_status: e.target.value,
                                                            })
                                                        }
                                                        className="w-full px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm text-ink-main"
                                                    >
                                                        <option value="not_applicable">Не применимо</option>
                                                        <option value="pregnant">Беременна</option>
                                                        <option value="breastfeeding">Кормление грудью</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Chronic Conditions */}
                                            <div className="pt-2 border-t border-divider">
                                                <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                    Хронические заболевания и Аллергии
                                                </label>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {conditions.length > 0 ? (
                                                        conditions.map((c: string, i: number) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100"
                                                            >
                                                                {c}
                                                                <button
                                                                    onClick={() => removeCondition(i)}
                                                                    className="hover:text-red-900 transition-colors cursor-pointer"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm font-medium text-ink-muted bg-surface-muted px-3 py-1.5 rounded-md">
                                                            Не указано
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={conditionInput}
                                                        onChange={(e) => setConditionInput(e.target.value)}
                                                        onKeyDown={(e) =>
                                                            e.key === "Enter" && addCondition()
                                                        }
                                                        placeholder="Например: Астма, Аллергия"
                                                        className="flex-1 px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                    />
                                                    <button
                                                        onClick={addCondition}
                                                        className="px-3 py-2 bg-surface-muted text-ink-main rounded-lg hover:bg-surface-hover transition-colors border border-divider cursor-pointer"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Medications */}
                                            <div className="pt-2 border-t border-divider">
                                                <label className="block text-[13px] font-semibold text-ink-main mb-1.5">
                                                    Медикаменты и Добавки
                                                </label>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {meds.length > 0 ? (
                                                        meds.map((m: string, i: number) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100"
                                                            >
                                                                {m}
                                                                <button
                                                                    onClick={() => removeMedication(i)}
                                                                    className="hover:text-blue-900 transition-colors cursor-pointer"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm font-medium text-ink-muted bg-surface-muted px-3 py-1.5 rounded-md">
                                                            Не указано
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={medicationInput}
                                                        onChange={(e) => setMedicationInput(e.target.value)}
                                                        onKeyDown={(e) =>
                                                            e.key === "Enter" && addMedication()
                                                        }
                                                        placeholder="Например: Vitamin D 2000IU"
                                                        className="flex-1 px-3 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface-base text-sm"
                                                    />
                                                    <button
                                                        onClick={addMedication}
                                                        className="px-3 py-2 bg-surface-muted text-ink-main rounded-lg hover:bg-surface-hover transition-colors border border-divider cursor-pointer"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ═══ TAB 4: WEARABLES HUB ═══ */}
                                    <TabsContent
                                        value="wearables"
                                        className="focus:outline-none space-y-4"
                                    >
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Card 1: Sleep & Recovery */}
                                            <DeviceWidgetCard
                                                title="Сон и Восстановление"
                                                icon={<Moon size={20} />}
                                                metrics={sleepMetrics}
                                                onManualEntry={() => setActiveManualEntry("sleep")}
                                                onScreenshotUpload={() =>
                                                    alert("OCR для скриншотов Oura / Apple Health — скоро!")
                                                }
                                            />

                                            {/* Card 2: Cardio & Activity */}
                                            <DeviceWidgetCard
                                                title="Кардио и Активность"
                                                icon={<Heart size={20} />}
                                                metrics={cardioMetrics}
                                                onManualEntry={() => setActiveManualEntry("cardio")}
                                                onScreenshotUpload={() =>
                                                    alert("OCR для скриншотов Garmin / Whoop — скоро!")
                                                }
                                            />

                                            {/* Card 3: Body Composition */}
                                            <DeviceWidgetCard
                                                title="Состав Тела"
                                                icon={<Scale size={20} />}
                                                metrics={bodyMetrics}
                                                onManualEntry={() => setActiveManualEntry("body")}
                                                onScreenshotUpload={() =>
                                                    alert("OCR для скриншотов весов — скоро!")
                                                }
                                            />

                                            {/* Card 4: Metabolic (CGM) */}
                                            <DeviceWidgetCard
                                                title="Метаболизм (CGM)"
                                                icon={<Droplets size={20} />}
                                                metrics={metabolicMetrics}
                                                onManualEntry={() => setActiveManualEntry("metabolic")}
                                                onScreenshotUpload={() =>
                                                    alert("OCR для Nutrisense / Levels — скоро!")
                                                }
                                            />

                                            {/* Card 5: Stress & Female Health */}
                                            <DeviceWidgetCard
                                                title="Стресс и Здоровье"
                                                icon={<Brain size={20} />}
                                                metrics={stressMetrics}
                                                onManualEntry={() => setActiveManualEntry("stress")}
                                                onScreenshotUpload={() =>
                                                    alert("OCR для скриншотов Apple Health — скоро!")
                                                }
                                            />
                                        </div>

                                        <p className="mt-4 text-xs text-center font-medium text-ink-muted bg-surface-muted py-2.5 px-4 rounded-full">
                                            Автоматическая синхронизация с Apple Health и Google Fit — скоро.
                                        </p>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-divider bg-white z-10 flex items-center justify-between">
                        <span className="text-sm text-success font-semibold transition-opacity min-w-[150px]">
                            {saveSuccess ? "✓ Профиль сохранён" : ""}
                        </span>
                        <button
                            onClick={() => handleSaveProfile()}
                            disabled={isSaving || loadingProfile}
                            className="px-6 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <svg
                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Сохраняю...
                                </>
                            ) : (
                                "Сохранить"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Manual Entry Dialogs (one per wearable category) ── */}
            {activeManualEntry && dialogConfig[activeManualEntry] && (
                <ManualEntryDialog
                    isOpen={true}
                    onClose={() => setActiveManualEntry(null)}
                    title={dialogConfig[activeManualEntry].title}
                    fields={dialogConfig[activeManualEntry].fields}
                    onSave={(values) => handleWearableSave(activeManualEntry, values)}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-ink-main text-center mb-3">
                            Вы абсолютно уверены?
                        </h2>
                        <p className="text-ink-muted text-center leading-relaxed mb-8">
                            Это действие необратимо. Все ваши анализы, история чата и фотографии будут удалены навсегда.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isDeleting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Удаление...
                                    </>
                                ) : (
                                    "Да, удалить аккаунт навсегда"
                                )}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="w-full py-4 bg-surface-muted text-ink-main font-bold rounded-2xl hover:bg-surface-hover disabled:opacity-50 transition-all border border-divider cursor-pointer"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
