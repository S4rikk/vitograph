"use client";
import DynamicOcrDialog from "./DynamicOcrDialog";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
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
    Lock,
    BrainCircuit,
} from "lucide-react";
import SupplementChecklistWidget from "@/components/shared/SupplementChecklistWidget";
import Logo from "@/components/ui/Logo";
import ChangePasswordForm from "./ChangePasswordForm";
import { toast } from "sonner";

const COMMON_TIMEZONES = [
    "UTC",
    "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow", "Europe/Kyiv", "Europe/Istanbul",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Sao_Paulo",
    "Asia/Dubai", "Asia/Almaty", "Asia/Tashkent", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore",
    "Australia/Sydney", "Australia/Perth", "Pacific/Auckland"
];

import { apiClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image-utils";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useFontScale } from "@/components/providers/FontScaleProvider";
import { FeedbackButton } from "../diary/FeedbackButton";
import type {
    MetricItem,
    MetricHistoryPoint,
    MetricFieldDefinition,
    WearableMetrics,
} from "@/types/wearable-types";
import { DEFAULT_WEARABLE_METRICS } from "@/types/wearable-types";
import {
    getSleepFields,
    getCardioFields,
    getBodyFields,
    getMetabolicFields,
    getStressFields
} from "@/lib/wearable-field-defs";

const LEGACY_SEX_MAP: Record<string, string> = {
    "Мужской": "male",
    "Женский": "female",
    "Другое": "other",
};

const LEGACY_ACTIVITY_MAP: Record<string, string> = {
    "Сидячий": "sedentary",
    "Лёгкий": "light",
    "Умеренный": "moderate",
    "Активный": "active",
    "Очень активный": "very_active",
};

const LEGACY_DIET_MAP: Record<string, string> = {
    "Всеядная (Omnivore)": "omnivore",
    "Вегетарианская": "vegetarian",
    "Веганская": "vegan",
    "Пескатарианская": "pescatarian",
    "Кето": "keto",
    "Другое (Диета)": "other",
};

const LEGACY_CLIMATE_MAP: Record<string, string> = {
    "Умеренный": "temperate",
    "Тропический": "tropical",
    "Сухой": "dry",
    "Континентальный": "continental",
    "Полярный": "polar",
};

const LEGACY_SUN_MAP: Record<string, string> = {
    "Минимальный": "minimal",
    "Умеренный": "moderate",
    "Высокий": "high",
};

const LEGACY_ALCOHOL_MAP: Record<string, string> = {
    "Не употребляю": "none",
    "Иногда": "occasional",
    "Умеренно": "moderate",
    "Часто": "heavy",
};

const LEGACY_WORK_MAP: Record<string, string> = {
    "Офис (сидячая)": "office_sedentary",
    "Офис (активная)": "office_active",
    "Удалёнка": "remote_flexible",
    "Физический труд": "manual_labor",
    "Сменная работа": "shift_work",
};

const LEGACY_PREGNANCY_MAP: Record<string, string> = {
    "Не применимо": "not_applicable",
    "Беременна": "pregnant",
    "Кормление грудью": "breastfeeding",
};

const LEGACY_STRESS_MAP: Record<string, string> = {
    "Низкий": "low",
    "Средний": "moderate",
    "Очень высокий": "very_high",
};

const mapLegacyValue = (val: unknown, fieldMap?: Record<string, string>): string | unknown => {
    if (typeof val === 'string' && fieldMap && fieldMap[val]) {
        return fieldMap[val];
    }
    return val;
};



// ── Card category type for tracking which dialog is open ──

type WearableCardCategory =
    | "sleep"
    | "cardio"
    | "body"
    | "metabolic"
    | "stress"
    | null;

// ── Helper: converts a category object to MetricItem array ──

const DeleteBadge = ({ onConfirm }: { onConfirm: () => void }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onConfirm();
        }}
        className="absolute -top-2 -right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transition-colors"
    >
        <X size={12} strokeWidth={3} />
    </button>
);

function toMetricItems(
    entries: [string, string, string][],
    data: Record<string, unknown>,
    history?: { metrics: Record<string, number | null>; date: string }[],
): MetricItem[] {
    return entries.map(([key, label, unit]) => {
        // Берём предыдущие значения (пропускаем первый = текущий)
        const previousPoints: MetricHistoryPoint[] | undefined = history && history.length > 1
            ? history.slice(1) // Пропускаем [0] = current
                .map(h => ({ value: h.metrics[key] ?? null, date: h.date }))
                .filter(h => h.value !== null)
            : undefined;

        return {
            id: key,
            label,
            value: (data[key] as string | number | null) ?? null,
            unit,
            history: previousPoints && previousPoints.length > 0 ? previousPoints : undefined,
        };
    });
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
    const tProfile = useTranslations("profile");
    const tLifestyle = useTranslations("lifestyle");
    const tWearables = useTranslations("wearables");
    const [activeTab, setActiveTab] = useState("overview");
    const [mounted, setMounted] = useState(false);
    const [ocrResult, setOcrResult] = useState<any>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    
    

    const { scale, setScale } = useFontScale();
    const currentLocale = useLocale();
    const [isChangingLocale, setIsChangingLocale] = useState(false);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        setMounted(true);
    }, []);

    // ── Profile data ──
    const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
    const [latestSemanticMetrics, setLatestSemanticMetrics] = useState<any>({});
    const [initialFormData, setInitialFormData] = useState<Record<string, unknown> | null>(null);
    const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isEditingMetrics, setIsEditingMetrics] = useState(false);
    // ── Tag inputs ──
    const [conditionInput, setConditionInput] = useState("");
    const [medicationInput, setMedicationInput] = useState("");

    // ── Wearable metrics ──
    const [wearablesLoaded, setWearablesLoaded] = useState(false);
    const [wearableMetrics, setWearableMetrics] =
        useState<WearableMetrics>(DEFAULT_WEARABLE_METRICS);
    const [wearableHistory, setWearableHistory] = useState<
        Record<string, { metrics: Record<string, number | null>; date: string }[]>
    >({});
            useState<WearableCardCategory>(null);

    
    const [activeOcrCategory, setActiveOcrCategory] = useState<WearableCardCategory>(null);
    const [ocrInitialValues, setOcrInitialValues] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (activeTab !== 'wearables' || wearablesLoaded) return;
        
        const loadWearables = async () => {
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('wearable_manual_metrics')
                    .select('category, metrics, semantic_metrics, recorded_at')
                    .eq('user_id', userId)
                    .order('recorded_at', { ascending: false });
                
                if (error || !data) return;
                
                const historyByCategory: Record<string, { metrics: Record<string, number | null>; date: string }[]> = {};
                for (const row of data) {
                    const category = row.category;
                    if (!historyByCategory[category]) {
                        historyByCategory[category] = [];
                    }
                    if (historyByCategory[category].length < 3) {
                        historyByCategory[category].push({
                            metrics: row.metrics,
                            date: row.recorded_at,
                        });
                    }
                }
                
                // Extract the freshest semantic_metrics across all categories
                let latestSemantic: any = {};
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        latestSemantic = row.semantic_metrics;
                        break;
                    }
                }
                setLatestSemanticMetrics(latestSemantic);
                
                // Сохраняем полную историю для UI
                setWearableHistory(historyByCategory);
                
                // Для основных значений — мержим все записи, non-null wins (freshest first)
                const latestByCategory: Record<string, Record<string, unknown>> = {};
                for (const [cat, entries] of Object.entries(historyByCategory)) {
                    const merged: Record<string, unknown> = {};
                    // entries отсортированы от новой к старой
                    // Проходим в обратном порядке (от старой к новой),
                    // чтобы свежие non-null значения перезаписывали старые
                    for (let i = entries.length - 1; i >= 0; i--) {
                        const metricsObj = entries[i].metrics as Record<string, unknown>;
                        for (const [key, val] of Object.entries(metricsObj)) {
                            if (val !== null && val !== undefined) {
                                merged[key] = val;
                            }
                        }
                    }
                    latestByCategory[cat] = merged;
                }
                
                const categoryMap: Record<string, keyof WearableMetrics> = {
                    sleep: 'sleepRecovery',
                    cardio: 'cardioActivity',
                    body: 'bodyComposition',
                    metabolic: 'metabolic',
                    stress: 'stressFemaleHealth',
                };
                
                setWearableMetrics(prev => {
                    const merged: WearableMetrics = { ...prev };
                    for (const [cat, metrics] of Object.entries(latestByCategory)) {
                        const field = categoryMap[cat];
                        if (field && metrics) {
                            merged[field] = { ...prev[field], ...(metrics as Record<string, unknown>) } as never;
                        }
                    }
                    return merged;
                });
                
                setWearablesLoaded(true);
            } catch (err) {
                console.error('[Wearables] Load failed:', err);
            }
        };
        
        loadWearables();
    }, [activeTab, wearablesLoaded, userId]);

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

    const handleClearLongTermMemory = async () => {
        if (window.confirm(tProfile("clearMemoryConfirm"))) {
            try {
                await apiClient.clearLongTermMemory();
                toast.success(tProfile("clearMemorySuccess"));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Clear memory failed";
                console.error("[ClearMemory] Error:", message);
                toast.error(tProfile("clearMemoryError"));
            }
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
        locale: "",
    });

    const isDirty = initialFormData ? JSON.stringify(formData) !== JSON.stringify(initialFormData) : false;

    const handleRequestClose = () => {
        if (isDirty) {
            setShowUnsavedConfirm(true);
        } else {
            setIsOpen(false);
        }
    };

    const handleForceClose = () => {
        setShowUnsavedConfirm(false);
        if (initialFormData) {
            setFormData(initialFormData);
        }
        setIsOpen(false);
    };

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
            const newFormData = {
                display_name: data.display_name ?? "",
                ai_name: data.ai_name ?? "",
                date_of_birth: data.date_of_birth
                    ? new Date(data.date_of_birth as string).toISOString().split("T")[0]
                    : "",
                biological_sex: mapLegacyValue(data.biological_sex ?? "", LEGACY_SEX_MAP),
                weight_kg: data.weight_kg ?? "",
                height_cm: data.height_cm ?? "",
                activity_level: mapLegacyValue(data.activity_level ?? "sedentary", LEGACY_ACTIVITY_MAP),
                diet_type: mapLegacyValue(data.diet_type ?? "omnivore", LEGACY_DIET_MAP),
                stress_level: mapLegacyValue(data.stress_level ?? "low", LEGACY_STRESS_MAP),
                climate_zone: mapLegacyValue(data.climate_zone ?? "temperate", LEGACY_CLIMATE_MAP),
                sun_exposure: mapLegacyValue(data.sun_exposure ?? "moderate", LEGACY_SUN_MAP),
                alcohol_frequency: mapLegacyValue(data.alcohol_frequency ?? "none", LEGACY_ALCOHOL_MAP),
                work_lifestyle: mapLegacyValue(data.work_lifestyle ?? "office_sedentary", LEGACY_WORK_MAP),
                physical_activity_minutes_weekly:
                    data.physical_activity_minutes_weekly ?? "",
                sleep_hours_avg: data.sleep_hours_avg ?? "",
                is_smoker: data.is_smoker ?? false,
                pregnancy_status: mapLegacyValue(data.pregnancy_status ?? "not_applicable", LEGACY_PREGNANCY_MAP),
                chronic_conditions: Array.isArray(data.chronic_conditions)
                    ? data.chronic_conditions
                    : [],
                medications: Array.isArray(data.medications) ? data.medications : [],
                city: data.city ?? "",
                timezone:
                    data.timezone ??
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                locale: data.locale ?? currentLocale,
            };
            setFormData(newFormData);
            setInitialFormData(newFormData);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            if (message.includes("404")) {
                setProfile(null);
                setInitialFormData({...formData}); // Инициализируем базовое состояние для нового пользователя
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
            const payload: any = {
                ...formData,
                ...(profile ? {} : { id: userId }), // Добавляем ID для новых пользователей (POST)
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
            const updatedData = profile 
                ? await apiClient.updateProfile(userId, payload)
                : await apiClient.createProfile(payload);

            // 2. Обновляем локальный стейт НАПРЯМУЮ, без вызова loadProfile()
            setProfile(updatedData);
            const updatedState = {
                ...formData,
                ...updatedData,
                ai_name: updatedData.ai_name ?? "",
                date_of_birth: updatedData.date_of_birth
                    ? new Date(updatedData.date_of_birth as string).toISOString().split("T")[0]
                    : "",
            };
            setFormData(updatedState);
            setInitialFormData(updatedState);

            // 3. Если язык изменился — перезагружаем страницу
            if (formData.locale !== initialFormData?.locale) {
                document.cookie = `NEXT_LOCALE=${formData.locale}; path=/; max-age=31536000; SameSite=Lax`;
                window.location.reload();
            }

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
        if (v < 18.5) return tProfile("bmiDeficit");
        if (v < 25) return tProfile("bmiNormal");
        if (v < 30) return tProfile("bmiExcess");
        return tProfile("bmiObese");
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

    const handleDeleteMetric = async (metricId: string) => {
        const newMetrics = { ...latestSemanticMetrics };
        let foundKey = Object.keys(newMetrics).find(k => {
            const m = newMetrics[k];
            const mId = m.id || `${m.originalName || m.semanticMeaning}_${isNaN(Number(m.numericValue !== null ? m.numericValue : m.rawValue)) ? 'text' : 'num'}_${m.unit || 'nounit'}`;
            return mId === metricId;
        });
        if (foundKey) {
            delete newMetrics[foundKey];
            setLatestSemanticMetrics(newMetrics);
            const supabase = createClient();
            await supabase.from('wearable_manual_metrics').insert({
                user_id: userId,
                category: 'manual',
                metrics: {},
                semantic_metrics: newMetrics,
                recorded_at: new Date().toISOString()
            });
            toast.success(tProfile("metricDeleted", { defaultValue: "Метрика удалена" }));
        }
    };
    
    const handleDeleteAllMetrics = async () => {
        if (window.confirm("Удалить все показатели с гаджетов?")) {
            setLatestSemanticMetrics({});
            const supabase = createClient();
            await supabase.from('wearable_manual_metrics').insert({
                user_id: userId,
                category: 'manual',
                metrics: {},
                semantic_metrics: {},
                recorded_at: new Date().toISOString()
            });
            setIsEditingMetrics(false);
            toast.success(tProfile("allMetricsDeleted", { defaultValue: "Все показатели удалены" }));
        }
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
        async (category: WearableCardCategory, values: Record<string, string>) => {
            if (!category) return;

            const parsed: Record<string, number | null> = {};
            for (const [key, val] of Object.entries(values)) {
                parsed[key] = val ? parseFloat(val) : null;
            }

            const categoryMap: Record<string, keyof WearableMetrics> = {
                sleep: "sleepRecovery",
                cardio: "cardioActivity",
                body: "bodyComposition",
                metabolic: "metabolic",
                stress: "stressFemaleHealth",
            };
            const field = categoryMap[category];
            if (!field) return;

            // ── Duplicate guard: skip if values are identical to current state ──
            const currentMetrics = wearableMetrics[field] as unknown as Record<string, unknown>;
            const isDuplicate = Object.keys(parsed).every(
                key => parsed[key] === (currentMetrics[key] as number | null)
            );
            if (isDuplicate) {
                // Данные идентичны — тихо закрываем диалог, ничего не сохраняем
                
                return;
            }

            setWearableMetrics((prev) => ({
                ...prev,
                [field]: { ...prev[field], ...parsed },
            }));

            try {
                const supabase = createClient();
                const { error } = await supabase
                    .from('wearable_manual_metrics')
                    .insert({
                        user_id: userId,
                        category: category,
                        metrics: parsed,
                        recorded_at: new Date().toISOString(),
                    });
                
                if (error) {
                    console.error('[Wearable] Save failed:', error);
                } else {
                    // Принудительно перезагружаем данные, чтобы обновить историю
                    setWearablesLoaded(false);
                }
            } catch (err) {
                console.error('[Wearable] Save failed:', err);
            }
        },
        [userId, wearableMetrics],
    );

        const handleDynamicOcrSave = async (payload: any) => {
        try {
            const currentMetrics = { ...latestSemanticMetrics };
            const newMetrics = payload.extractedMetrics || {};
            
            for (const [newKey, newM] of Object.entries(newMetrics)) {
                const newName = (newM as any).standardizedCategory || (newM as any).originalName || (newM as any).semanticMeaning;
                let foundKey = null;
                for (const [oldKey, oldM] of Object.entries(currentMetrics)) {
                    const oldName = (oldM as any).standardizedCategory || (oldM as any).originalName || (oldM as any).semanticMeaning;
                    if (oldName && newName && oldName.toLowerCase() === newName.toLowerCase()) {
                        foundKey = oldKey;
                        break;
                    }
                }
                if (foundKey) {
                    currentMetrics[foundKey] = newM;
                } else {
                    currentMetrics[newKey] = newM;
                }
            }

            const supabase = createClient();
            const { error } = await supabase
                .from('wearable_manual_metrics')
                .insert({
                    user_id: userId,
                    category: payload.detectedCategory,
                    metrics: {}, // Legacy column
                    semantic_metrics: currentMetrics,
                    recorded_at: new Date().toISOString(),
                });
            
            if (error) throw error;
            
            // Trigger wearables reload
            setWearablesLoaded(false);
            setOcrResult(null);
            toast.success(tProfile("ocrSuccess")); // Or custom translated save success
        } catch (err) {
            console.error('[Wearable] Save failed:', err);
            toast.error(tProfile("ocrError"));
        }
    };

const handleScreenshotTrigger = (category: WearableCardCategory) => {
        setActiveOcrCategory(category);
        fileInputRef.current?.click();
    };

    const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeOcrCategory) return;
        
        try {
            setIsOcrLoading(true);
            const base64 = await compressImage(file, 1536);
            
            const parsedResult = await apiClient.analyzeWearableScreenshot(base64);
            
            if (parsedResult.detectedCategory === "unknown" || !parsedResult.extractedMetrics) {
                toast.error(tProfile("ocrUnknownCategory"));
                return;
            }

            const stringValues: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsedResult.extractedMetrics)) {
                if (v !== null && v !== undefined) {
                    stringValues[k] = String(v);
                }
            }
            
            setOcrResult(parsedResult);
            toast.success(tProfile("ocrSuccess"));
        } catch (err) {
            console.error("OCR Error:", err);
            toast.error(tProfile("ocrError"));
        } finally {
            setIsOcrLoading(false);
            setActiveOcrCategory(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
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
                <span className="text-sm font-medium text-ink hidden sm:inline-block">
                    {userEmail.split("@")[0]}
                </span>
            </button>

            {/* Overlay */}
            {mounted && isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity backdrop-blur-sm"
                    onClick={handleRequestClose}
                />
            )}

            {/* Slide-out Sheet */}
            {mounted && (
                <div
                    className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-transparent shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"
                        }`}
                >
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-white dark:bg-surface z-10 relative">
                        <div>
                            <h2 className="text-xl font-bold text-ink">{tProfile("title")}</h2>
                            <p className="text-sm text-ink-muted mt-0.5">{userEmail}</p>
                        </div>
                        <button
                            onClick={handleRequestClose}
                            className="p-2 text-ink-muted hover:text-ink hover:bg-surface-muted rounded-full transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto bg-transparent">
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

                                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                    {/* ── Custom Glassmorphism Overlapping Tabs ── */}
                                    {/* ── Custom Glassmorphism Overlapping Tabs ── */}
                                    <div className="flex items-end pl-4 overflow-visible w-full -mb-[3px]">
                                        {[
                                            { id: "overview", label: tProfile("tabs.overview"), icon: User },
                                            { id: "lifestyle", label: tProfile("tabs.lifestyle"), icon: Leaf },
                                            { id: "medical", label: tProfile("tabs.medical"), icon: Activity },
                                            { id: "wearables", label: tProfile("tabs.wearables"), icon: Watch },
                                        ].map((tab, idx) => {
                                            const isActive = activeTab === tab.id;
                                            const zIndex = isActive ? 20 : 5 - idx;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id)}
                                                    style={{ zIndex, borderBottom: 'none' }}
                                                    className={`relative -ml-4 px-4 pt-3 rounded-t-2xl transition-all duration-300 flex items-center gap-2 text-xs font-semibold cursor-pointer min-w-0 ${
                                                        isActive
                                                            ? "bg-white/60 dark:bg-surface/60 text-primary-800 backdrop-blur-xl border border-white/70 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_1px_0_2px_rgba(255,255,255,0.5),inset_-1px_0_2px_rgba(255,255,255,0.5),0_-4px_10px_rgba(0,0,0,0.05)] pb-4"
                                                            : "bg-surface-muted/50 text-ink-muted backdrop-blur-md border border-white/30 shadow-[inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.05)] hover:bg-white/40 dark:hover:bg-surface/40 pb-2"
                                                    }`}
                                                    aria-selected={isActive}
                                                    role="tab"
                                                >
                                                    <tab.icon size={16} className={`shrink-0 transition-colors ${isActive ? "text-primary-600" : "text-ink-muted"}`} />
                                                    <span className={`transition-all duration-300 ${isActive ? "whitespace-nowrap opacity-100 max-w-[200px]" : "hidden sm:block truncate opacity-70"}`}>
                                                        {tab.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* ═══ TAB 1: OVERVIEW ═══ */}
                                    <TabsContent
                                        value="overview"
                                        className="!mt-0 relative z-10 bg-white/60 dark:bg-surface/60 backdrop-blur-xl border border-white/70 border-t-transparent shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_10px_20px_-10px_rgba(0,0,0,0.1)] rounded-2xl rounded-tl-none p-5 sm:p-6 space-y-6 focus:outline-none"
                                    >
                                        {/* Personal Info */}
                                        <div className="bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink border-b border-border pb-3">{tProfile("aboutSection")}</h3>
                                            <div className="space-y-4">
                                                <div className="flex flex-col h-full">
                                                    <label
                                                        htmlFor="display_name"
                                                        className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                    >{tProfile("name")}</label>
                                                    <input
                                                        id="display_name"
                                                        type="text"
                                                        value={String(formData.display_name ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, display_name: e.target.value })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("noData")}
                                                    />
                                                </div>

                                                <div className="flex flex-col h-full">
                                                    <label
                                                        htmlFor="ai_name"
                                                        className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                    >{tProfile("aiName")}</label>
                                                    <input
                                                        id="ai_name"
                                                        type="text"
                                                        value={String(formData.ai_name ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, ai_name: e.target.value })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("aiNamePlaceholder")}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div className="flex flex-col h-full">
                                                        <label
                                                            htmlFor="date_of_birth"
                                                            className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                        >{tProfile("dateOfBirth")}</label>
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
                                                            className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col h-full">
                                                        <label
                                                            htmlFor="biological_sex"
                                                            className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                        >{tProfile("sex")}</label>
                                                        <select
                                                            id="biological_sex"
                                                            value={String(formData.biological_sex ?? "")}
                                                            onChange={(e) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    biological_sex: e.target.value,
                                                                })
                                                            }
                                                            className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                        >
                                                            <option value="">{tProfile("noData")}</option>
                                                            <option value="male">{tProfile("sexOptions.male")}</option>
                                                            <option value="female">{tProfile("sexOptions.female")}</option>
                                                            <option value="other">{tProfile("sexOptions.other")}</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Physical Parameters */}
                                        <div className="bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                                                <h3 className="font-semibold text-ink">{tProfile("physicalParams")}</h3>
                                                {bmi && (
                                                    <div className="px-2.5 py-1 text-xs font-bold rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                                                        {tProfile("bmi")}: {bmi} ({bmiCategory(parseFloat(bmi))})
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="flex flex-col h-full">
                                                    <label
                                                        htmlFor="weight_kg"
                                                        className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                    >{tProfile("weight")} (кг)</label>
                                                    <input
                                                        id="weight_kg"
                                                        type="number"
                                                        step="0.1"
                                                        value={String(formData.weight_kg ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, weight_kg: e.target.value })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("noData")}
                                                    />
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label
                                                        htmlFor="height_cm"
                                                        className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                    >{tProfile("height")} (см)</label>
                                                    <input
                                                        id="height_cm"
                                                        type="number"
                                                        value={String(formData.height_cm ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, height_cm: e.target.value })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("noData")}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="flex flex-col h-full">
                                                    <label
                                                        htmlFor="city"
                                                        className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                    >{tProfile("city")}</label>
                                                    <input
                                                        id="city"
                                                        type="text"
                                                        value={String(formData.city ?? "")}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, city: e.target.value })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("noData")}
                                                    />
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label
                                                        htmlFor="timezone"
                                                        className="block text-[0.8125rem] font-semibold text-ink mb-1.5"
                                                    >{tProfile("timezone")}</label>
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
                                                            className="mt-auto w-full pl-3 pr-10 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
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
                                                            <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-60 overflow-y-auto rounded-xl border border-border shadow-xl bg-surface/95 backdrop-blur-md py-1 animate-in fade-in slide-in-from-top-1 duration-200">
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
                                                                            className="mt-auto w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer flex items-center gap-2 group"
                                                                        >
                                                                            <span className="w-1 h-1 rounded-full bg-ink-muted group-hover:bg-primary-400" />
                                                                            {tz}
                                                                        </button>
                                                                    ))
                                                                ) : (
                                                                    <div className="px-3 py-2 text-xs text-ink-muted italic">{tProfile("nothingFound")}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* App Settings */}
                                        <div className="mt-8 bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink border-b border-border pb-3">{tProfile("appSettings")}</h3>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tProfile("language")}</label>
                                                    <select
                                                        value={String(formData.locale ?? currentLocale)}
                                                        disabled={isChangingLocale}
                                                        onChange={(e) => {
                                                            const newLocale = e.target.value;
                                                            setFormData({ ...formData, locale: newLocale });
                                                        }}
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink disabled:opacity-50"
                                                    >
                                                        <option value="ru">Русский</option>
                                                        <option value="en">English</option>
                                                        <option value="es">Español</option>
                                                        <option value="fr">Français</option>
                                                        <option value="de">Deutsch</option>
                                                        <option value="pt">Português</option>
                                                        <option value="zh">中文</option>
                                                        <option value="ja">日本語</option>
                                                        <option value="ko">한국어</option>
                                                        <option value="tr">Türkçe</option>
                                                        <option value="ar">العربية</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tProfile("fontSize")}</label>
                                                    <select
                                                        value={scale}
                                                        onChange={(e) => setScale(e.target.value as "small" | "medium" | "large")}
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="small">{tProfile("fontSizes.compact")}</option>
                                                        <option value="medium">{tProfile("fontSizes.medium")}</option>
                                                        <option value="large">{tProfile("fontSizes.xlarge")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tProfile("theme")}</label>
                                                    <select
                                                        value={theme}
                                                        onChange={(e) => setTheme(e.target.value)}
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="system">{tProfile("themes.system")}</option>
                                                        <option value="light">{tProfile("themes.light")}</option>
                                                        <option value="dark">{tProfile("themes.dark")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full justify-end pt-5">
                                                    <FeedbackButton />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Security — Change Password */}
                                        <div className="mt-8 bg-white dark:bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                                            <details className="group">
                                                <summary className="flex items-center justify-between p-5 font-semibold text-ink cursor-pointer list-none hover:bg-surface-muted transition-colors [&::-webkit-details-marker]:hidden">
                                                    <div className="flex items-center gap-2">
                                                        <Lock size={18} className="text-ink-muted" />
                                                        <span>{tProfile("changePassword.title")}</span>
                                                    </div>
                                                    <span className="transition group-open:-rotate-180">
                                                        <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </span>
                                                </summary>
                                                <div className="p-5 pt-0 border-t border-border mt-2">
                                                    <ChangePasswordForm />
                                                </div>
                                            </details>
                                        </div>

                                        {/* FAQ & About */}
                                        <div className="mt-8 space-y-4">
                                            <div className="bg-white dark:bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                                                <details className="group">
                                                    <summary className="flex items-center justify-between p-5 font-semibold text-ink cursor-pointer list-none hover:bg-surface-muted transition-colors [&::-webkit-details-marker]:hidden">
                                                        <span>{tProfile("faq.faqTitle")}</span>
                                                        <span className="transition group-open:-rotate-180">
                                                            <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </span>
                                                    </summary>
                                                    <div className="p-5 pt-0 space-y-4 border-t border-border mt-2">
                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q1")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a1")}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q2")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <div className="space-y-2">
                                                                    {tProfile.rich("faq.a2", { p: (chunks) => <p>{chunks}</p> })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q3")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a3")}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q4")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a4")}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q5")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a5")}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q6")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a6")}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q7")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a7")}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1.5 border-b border-border pb-4 last:border-0 last:pb-0">
                                                            <div className="font-semibold text-ink flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-primary-100 text-primary-700 text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.question")}</span>
                                                                <span>{tProfile("faq.q8")}</span>
                                                            </div>
                                                            <div className="text-[0.875rem] text-ink-muted leading-relaxed flex gap-2 items-start">
                                                                <span className="shrink-0 px-2 py-0.5 rounded bg-surface-muted text-ink-muted text-[0.625rem] uppercase tracking-wider font-bold mt-0.5">{tProfile("faq.answer")}</span>
                                                                <span>{tProfile("faq.a8")}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </details>
                                            </div>

                                            <div className="bg-white dark:bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                                                <details className="group">
                                                    <summary className="flex items-center justify-between p-5 font-semibold text-ink cursor-pointer list-none hover:bg-surface-muted transition-colors [&::-webkit-details-marker]:hidden">
                                                        <div className="flex items-center gap-2">
                                                            <span>{tProfile("about.title")}</span>
                                                            <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-[0.625rem] font-bold uppercase tracking-widest border border-primary-200/50">v2.0</span>
                                                        </div>
                                                        <span className="transition group-open:-rotate-180">
                                                            <svg className="w-5 h-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </span>
                                                    </summary>
                                                    <div className="p-5 pt-0 text-[0.875rem] text-ink-muted space-y-5 border-t border-border mt-2">
                                                        {/* Header banner */}
                                                        <div className="text-center bg-surface-muted rounded-xl p-4 mt-2 flex flex-col items-center">
                                                            <Logo size="lg" />
                                                            <p className="text-primary-600 font-bold italic mt-1.5">Feed your cells, find balance.</p>
                                                        </div>

                                                        <div className="space-y-3 leading-relaxed">
                                                            <p>{tProfile("about.intro1")} <strong className="text-ink">{tProfile("about.intro2")}</strong></p>
                                                            <p>{tProfile("about.description")}</p>
                                                        </div>

                                                        {/* How we do it list */}
                                                        <div className="space-y-4">
                                                            <h4 className="font-bold text-ink text-[1rem] border-b border-border pb-2">{tProfile("about.howTitle")}</h4>
                                                            <ul className="space-y-4">
                                                                <li className="flex gap-4">
                                                                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[0.8125rem] shadow-sm">1</div>
                                                                    <p className="leading-relaxed mt-1"><strong className="text-ink">{tProfile("about.pillar1Title")}</strong> {tProfile("about.pillar1Desc")}</p>
                                                                </li>
                                                                <li className="flex gap-4">
                                                                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[0.8125rem] shadow-sm">2</div>
                                                                    <p className="leading-relaxed mt-1"><strong className="text-ink">{tProfile("about.pillar2Title")}</strong> {tProfile("about.pillar2Desc")}</p>
                                                                </li>
                                                                <li className="flex gap-4">
                                                                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-[0.8125rem] shadow-sm">3</div>
                                                                    <p className="leading-relaxed mt-1"><strong className="text-ink">{tProfile("about.pillar3Title")}</strong> {tProfile("about.pillar3Desc")}</p>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                        
                                                        {/* Disclaimer footer */}
                                                        <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-4 mt-6 text-[0.8125rem] leading-relaxed font-medium">
                                                            {tProfile("about.closing")}
                                                        </div>
                                                    </div>
                                                </details>
                                            </div>
                                        </div>

                                        {/* Danger Zone */}
                                        <div className="mt-8 pt-8 border-t-2 border-red-100 space-y-4">
                                            <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-tight">
                                                <AlertTriangle size={16} /> {tProfile("dangerZone")}
                                            </h3>
                                            <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm">
                                                <p className="text-[0.8125rem] text-red-700 leading-relaxed font-medium mb-4">
                                                    {tProfile("dangerZoneDesc")}
                                                </p>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    className="mt-auto w-full sm:w-auto px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer mb-3"
                                                >
                                                    <Trash2 size={16} /> {tProfile("deleteAccountBtn")}
                                                </button>

                                                <p className="text-[0.8125rem] text-red-700 leading-relaxed font-medium mb-4 border-t border-red-200 pt-4">
                                                    Очистка памяти ИИ удалит все факты, эмоциональный профиль и историю ваших предпочтений.
                                                </p>
                                                <button
                                                    onClick={handleClearLongTermMemory}
                                                    className="mt-auto w-full sm:w-auto px-5 py-2.5 bg-transparent border border-red-600 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    <BrainCircuit size={16} /> {tProfile("clearMemoryBtn")}
                                                </button>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ═══ TAB 2: LIFESTYLE ═══ */}
                                    <TabsContent
                                        value="lifestyle"
                                        className="!mt-0 relative z-10 bg-white/60 dark:bg-surface/60 backdrop-blur-xl border border-white/70 border-t-transparent shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_10px_20px_-10px_rgba(0,0,0,0.1)] rounded-2xl rounded-tl-none p-5 sm:p-6 space-y-6 focus:outline-none"
                                    >
                                        {/* Nutrition & Environment */}
                                        <div className="bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink border-b border-border pb-3">
                                                {tLifestyle("nutritionEnvironment")}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                        {tLifestyle("dietType")}
                                                    </label>
                                                    <select
                                                        value={String(formData.diet_type)}
                                                        onChange={(e) =>
                                                            setFormData({ ...formData, diet_type: e.target.value })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="omnivore">{tLifestyle("dietOptions.omnivore")}</option>
                                                        <option value="vegetarian">{tLifestyle("dietOptions.vegetarian")}</option>
                                                        <option value="vegan">{tLifestyle("dietOptions.vegan")}</option>
                                                        <option value="pescatarian">Pescatarian</option>
                                                        <option value="keto">{tLifestyle("dietOptions.keto")}</option>
                                                        <option value="other">{tLifestyle("dietOptions.other")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tLifestyle("alcohol")}</label>
                                                    <select
                                                        value={String(formData.alcohol_frequency)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                alcohol_frequency: e.target.value,
                                                            })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="none">{tLifestyle("alcoholOptions.none")}</option>
                                                        <option value="occasional">{tLifestyle("alcoholOccasional")}</option>
                                                        <option value="moderate">{tLifestyle("alcoholOptions.moderate")}</option>
                                                        <option value="heavy">{tLifestyle("alcoholOptions.frequent")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                        {tLifestyle("climateLabel")}
                                                    </label>
                                                    <select
                                                        value={String(formData.climate_zone)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                climate_zone: e.target.value,
                                                            })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="temperate">{tLifestyle("climateOptions.temperate")}</option>
                                                        <option value="tropical">{tLifestyle("climateTropical")}</option>
                                                        <option value="dry">{tLifestyle("climateDry")}</option>
                                                        <option value="continental">{tLifestyle("climateContinental")}</option>
                                                        <option value="polar">{tLifestyle("climatePolar")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                        {tLifestyle("sunExposure")}
                                                    </label>
                                                    <select
                                                        value={String(formData.sun_exposure)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                sun_exposure: e.target.value,
                                                            })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="minimal">{tLifestyle("sunMinimal")}</option>
                                                        <option value="moderate">{tLifestyle("sunModerate")}</option>
                                                        <option value="high">{tLifestyle("sunHigh")}</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Activity & Recovery */}
                                        <div className="bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink border-b border-border pb-3">
                                                {tLifestyle("activityRecovery")}
                                            </h3>
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tLifestyle("activityLevel")}</label>
                                                    <select
                                                        value={String(formData.activity_level)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                activity_level: e.target.value,
                                                            })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="sedentary">{tLifestyle("activityOptions.sedentary")}</option>
                                                        <option value="light">{tLifestyle("activityOptions.light")}</option>
                                                        <option value="moderate">{tLifestyle("activityOptions.moderate")}</option>
                                                        <option value="active">{tLifestyle("activityOptions.active")}</option>
                                                        <option value="very_active">{tLifestyle("activityVeryActive")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                        {tLifestyle("workType")}
                                                    </label>
                                                    <select
                                                        value={String(formData.work_lifestyle)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                work_lifestyle: e.target.value,
                                                            })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="office_sedentary">{tLifestyle("workOfficeSedentary")}</option>
                                                        <option value="office_active">{tLifestyle("workOfficeActive")}</option>
                                                        <option value="remote_flexible">{tLifestyle("workRemote")}</option>
                                                        <option value="manual_labor">{tLifestyle("workManualLabor")}</option>
                                                        <option value="shift_work">{tLifestyle("workShift")}</option>
                                                    </select>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                        {tLifestyle("cardioWeekly")}
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
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("noData")}
                                                    />
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tLifestyle("sleepHours")}</label>
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
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                        placeholder={tProfile("noData")}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sleep & Stress */}
                                        <div className="bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
                                            <h3 className="font-semibold text-ink border-b border-border pb-3">
                                                {tLifestyle("sleepStress")}
                                            </h3>
                                            <div className="flex flex-col h-full">
                                                <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                    {tLifestyle("baseStressLevel")}
                                                </label>
                                                <select
                                                    value={String(formData.stress_level)}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            stress_level: e.target.value,
                                                        })
                                                    }
                                                    className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                >
                                                    <option value="low">{tLifestyle("stressOptions.low")}</option>
                                                    <option value="moderate">{tLifestyle("stressOptions.moderate")}</option>
                                                    <option value="high">{tLifestyle("stressOptions.high")}</option>
                                                    <option value="very_high">{tLifestyle("stressOptions.veryHigh")}</option>
                                                </select>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    {/* ═══ TAB 3: MEDICAL CONTEXT ═══ */}
                                    <TabsContent
                                        value="medical"
                                        className="!mt-0 relative z-10 bg-white/60 dark:bg-surface/60 backdrop-blur-xl border border-white/70 border-t-transparent shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_10px_20px_-10px_rgba(0,0,0,0.1)] rounded-2xl rounded-tl-none p-5 sm:p-6 space-y-6 focus:outline-none"
                                    >
                                        <div className="bg-white dark:bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-5">
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
                                                        className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <label
                                                        htmlFor="isSmoker"
                                                        className="text-[0.8125rem] font-semibold text-ink"
                                                    >
                                                        {tLifestyle("smoking")}
                                                    </label>
                                                </div>
                                                <div className="flex flex-col h-full">
                                                    <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                        {tLifestyle("pregnancy")}
                                                    </label>
                                                    <select
                                                        value={String(formData.pregnancy_status)}
                                                        onChange={(e) =>
                                                            setFormData({
                                                                ...formData,
                                                                pregnancy_status: e.target.value,
                                                            })
                                                        }
                                                        className="mt-auto w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm text-ink"
                                                    >
                                                        <option value="not_applicable">{tLifestyle("pregnancyNotApplicable")}</option>
                                                        <option value="pregnant">{tLifestyle("pregnancyPregnant")}</option>
                                                        <option value="breastfeeding">{tLifestyle("pregnancyBreastfeeding")}</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Chronic Conditions */}
                                            <div className="pt-2 border-t border-border">
                                                <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">{tLifestyle("chronicConditions")}</label>
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
                                                        <span className="text-sm font-medium text-ink-muted bg-surface-muted px-3 py-1.5 rounded-md">{tProfile("noData")}</span>
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
                                                        placeholder={tProfile("manualEntry")}
                                                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                    />
                                                    <button
                                                        onClick={addCondition}
                                                        className="px-3 py-2 bg-surface-muted text-ink rounded-lg hover:bg-surface-hover transition-colors border border-border cursor-pointer"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Medications */}
                                            <div className="pt-2 border-t border-border">
                                                <label className="block text-[0.8125rem] font-semibold text-ink mb-1.5">
                                                    {tLifestyle("medicationsSupplements")}
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
                                                        <span className="text-sm font-medium text-ink-muted bg-surface-muted px-3 py-1.5 rounded-md">{tProfile("noData")}</span>
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
                                                        placeholder={tLifestyle("medPlaceholder")}
                                                        className="flex-1 px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-sm"
                                                    />
                                                    <button
                                                        onClick={addMedication}
                                                        className="px-3 py-2 bg-surface-muted text-ink rounded-lg hover:bg-surface-hover transition-colors border border-border cursor-pointer"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                                
                                                {/* Daily Supplements Checklist */}
                                                <SupplementChecklistWidget variant="default" providedMeds={meds} />
                                            </div>
                                        </div>
                                    </TabsContent>

                                                                        {/* ═══ TAB 4: WEARABLES HUB ═══ */}
                                    <TabsContent
                                        value="wearables"
                                        className="!mt-0 relative z-10 bg-white/60 dark:bg-surface/60 backdrop-blur-xl border border-white/70 border-t-transparent shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_10px_20px_-10px_rgba(0,0,0,0.1)] rounded-2xl rounded-tl-none p-5 sm:p-6 space-y-4 focus:outline-none"
                                    >
                                        <div className="flex flex-col gap-6">
                                            {/* Top Action Bar */}
                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                                                <button
                                                    onClick={() => handleScreenshotTrigger("manual" as any)}
                                                    disabled={isOcrLoading}
                                                    className="w-full sm:flex-1 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    {isOcrLoading ? (
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Activity size={20} />
                                                    )}
                                                    Сканировать данные
                                                </button>
                                                <button
                                                    onClick={() => setOcrResult({ detectedCategory: "manual", extractedMetrics: [] })}
                                                    className="w-full sm:w-auto px-6 py-3.5 bg-surface-muted text-ink font-semibold rounded-xl hover:bg-surface-hover transition-all shadow-sm border border-border cursor-pointer whitespace-nowrap"
                                                >
                                                    Ввести вручную
                                                </button>
                                            </div>

                                            {Object.keys(latestSemanticMetrics).length === 0 ? (
                                                /* Empty State (Zero Data) */
                                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-md border border-white/40 shadow-xl">
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-400/20 rounded-full blur-3xl pointer-events-none" />
                                                    <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-6 relative z-10">
                                                        <Watch size={40} className="text-white" />
                                                    </div>
                                                    <h3 className="text-2xl font-bold text-ink mb-3 relative z-10">
                                                        Умная синхронизация
                                                    </h3>
                                                    <p className="text-ink-muted max-w-sm mx-auto leading-relaxed relative z-10">
                                                        Сделайте скриншот из любого фитнес-приложения (Garmin, Oura, Apple Health). Наш ИИ сам найдет метрики и бережно разложит их по полочкам.
                                                    </p>
                                                </div>
                                            ) : (
                                                /* Filled State */
                                                <div className="bg-surface/80 backdrop-blur-md border border-white/20 rounded-3xl p-6 shadow-xl relative mt-4">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-xl font-bold text-ink flex items-center gap-2">
                                                            <Watch className="text-primary-500" size={24} />
                                                            Показатели с гаджетов
                                                        </h3>
                                                        <button 
                                                            onClick={() => setIsEditingMetrics(!isEditingMetrics)}
                                                            className={`p-2 rounded-full transition-colors ${isEditingMetrics ? 'bg-red-500/20 text-red-500' : 'bg-surface hover:bg-surface-hover text-ink-muted'}`}
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                    
                                                    {isEditingMetrics && (
                                                        <div className="mb-4 flex justify-end">
                                                            <button 
                                                                onClick={handleDeleteAllMetrics}
                                                                className="text-xs font-medium bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                                                            >
                                                                Очистить всё
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                        {(() => {
                                                            const rawMetrics = Object.values(latestSemanticMetrics) as any[];
                                                        const finalGroups: {base: any, progress?: any}[] = [];
                                                        const usedIndexes = new Set<number>();

                                                        // 1. Group pairs (base + progress)
                                                        rawMetrics.forEach((m1, i) => {
                                                            if (usedIndexes.has(i)) return;
                                                            
                                                            const name1 = (m1.originalName || m1.semanticMeaning || "").toLowerCase();
                                                            const isProgress1 = m1.unit === "%" || name1.includes("progress") || name1.includes("goal");
                                                            
                                                            let matchIdx = -1;
                                                            for (let j = 0; j < rawMetrics.length; j++) {
                                                                if (i === j || usedIndexes.has(j)) continue;
                                                                const m2 = rawMetrics[j];
                                                                const name2 = (m2.originalName || m2.semanticMeaning || "").toLowerCase();
                                                                const isProgress2 = m2.unit === "%" || name2.includes("progress") || name2.includes("goal");
                                                                
                                                                if (isProgress1 === isProgress2) continue;
                                                                
                                                                const clean1 = name1.replace(" goal", "").replace(" progress", "").trim();
                                                                const clean2 = name2.replace(" goal", "").replace(" progress", "").trim();
                                                                
                                                                if (clean1 === clean2 || clean1.startsWith(clean2) || clean2.startsWith(clean1)) {
                                                                    matchIdx = j;
                                                                    break;
                                                                }
                                                            }
                                                            
                                                            if (matchIdx !== -1) {
                                                                usedIndexes.add(i);
                                                                usedIndexes.add(matchIdx);
                                                                const m2 = rawMetrics[matchIdx];
                                                                finalGroups.push({
                                                                    base: isProgress1 ? m2 : m1,
                                                                    progress: isProgress1 ? m1 : m2
                                                                });
                                                            }
                                                        });

                                                        // 2. Add remaining & deduplicate
                                                        rawMetrics.forEach((m, i) => {
                                                            if (!usedIndexes.has(i)) {
                                                                const name = (m.originalName || m.semanticMeaning || "").toLowerCase().trim();
                                                                // check exact duplicates by value and similar name
                                                                const isDup = finalGroups.some(g => {
                                                                    const gName = (g.base.originalName || g.base.semanticMeaning || "").toLowerCase().trim();
                                                                    if (name.includes(gName) || gName.includes(name)) {
                                                                        if (m.numericValue !== null && g.base.numericValue !== null && m.numericValue === g.base.numericValue) {
                                                                            return true;
                                                                        }
                                                                        if (m.rawValue === g.base.rawValue) return true;
                                                                    }
                                                                    return false;
                                                                });
                                                                
                                                                if (!isDup) {
                                                                    finalGroups.push({ base: m });
                                                                }
                                                            }
                                                        });

                                                        return finalGroups.map((group, idx) => {
                                                            const { base, progress } = group;
                                                            return (
                                                                <div key={idx} className="bg-white dark:bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                                                                    {isEditingMetrics && (
                                                                        <DeleteBadge onConfirm={() => {
                                                                            const bId = base.id || `${base.originalName || base.semanticMeaning}_${isNaN(Number(base.numericValue !== null ? base.numericValue : base.rawValue)) ? 'text' : 'num'}_${base.unit || 'nounit'}`;
                                                                            handleDeleteMetric(bId);
                                                                            if (progress) {
                                                                                const pId = progress.id || `${progress.originalName || progress.semanticMeaning}_${isNaN(Number(progress.numericValue !== null ? progress.numericValue : progress.rawValue)) ? 'text' : 'num'}_${progress.unit || 'nounit'}`;
                                                                                handleDeleteMetric(pId);
                                                                            }
                                                                        }} />
                                                                    )}
                                                                    <div className="text-xs text-ink-muted font-medium mb-2 line-clamp-2 leading-tight" title={base.semanticMeaning}>
                                                                        {base.originalName || base.semanticMeaning}
                                                                    </div>
                                                                    
                                                                    <div className="mt-auto flex flex-col items-start gap-1">
                                                                        {progress ? (
                                                                            <div className="inline-flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-md">
                                                                                {progress.numericValue !== null ? progress.numericValue : progress.rawValue}
                                                                                {progress.unit ? progress.unit : "%"}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="h-4 sm:h-5 invisible"></div>
                                                                        )}
                                                                        
                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                            <span className="text-lg sm:text-xl font-bold text-ink">
                                                                                {base.numericValue !== null ? base.numericValue : base.rawValue}
                                                                            </span>
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted">{base.unit}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-border bg-surface z-10 flex items-center justify-between">
                        <span className="text-sm text-success font-semibold transition-opacity min-w-[150px]">
                            {saveSuccess ? tProfile("profileSaved") : ""}
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
                                    {tProfile("saving")}
                                </>
                            ) : (
                                tProfile("save")
                            )}
                        </button>
                    </div>
                </div>
            )}
            <DynamicOcrDialog
                isOpen={ocrResult !== null}
                onClose={() => setOcrResult(null)}
                ocrResult={ocrResult}
                onSave={handleDynamicOcrSave}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-surface rounded-3xl max-w-md w-full p-8 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-ink text-center mb-3">
                            {tProfile("areYouSure")}
                        </h2>
                        <p className="text-ink-muted text-center leading-relaxed mb-8">
                            {tProfile("deleteWarning")}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="mt-auto w-full py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isDeleting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>{tProfile("deleting")}</>
                                ) : (
                                    tProfile("deleteForever")
                                )}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="mt-auto w-full py-4 bg-surface-muted text-ink font-bold rounded-2xl hover:bg-surface-hover disabled:opacity-50 transition-all border border-border cursor-pointer"
                            >
                                {tProfile("cancel")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Unsaved Changes Confirmation Modal */}
            {showUnsavedConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-surface rounded-3xl max-w-sm w-full p-8 shadow-2xl border border-border animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-ink text-center mb-3">
                            {tProfile("closeProfile")}
                        </h2>
                        <p className="text-ink-muted text-center leading-relaxed mb-8">
                            {tProfile("unsavedWarning")}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleForceClose}
                                className="mt-auto w-full py-4 bg-amber-600 text-white font-bold rounded-2xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 active:scale-[0.98] cursor-pointer"
                            >
                                {tProfile("leaveWithout")}
                            </button>
                            <button
                                onClick={() => setShowUnsavedConfirm(false)}
                                className="mt-auto w-full py-4 bg-surface-muted text-ink font-bold rounded-2xl hover:bg-surface-hover transition-all border border-border cursor-pointer"
                            >
                                {tProfile("stayAndContinue")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* OCR File Input */}
            <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleScreenshotChange} 
            />
        </>
    );
}
