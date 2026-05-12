"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, Sparkles, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface Symptom {
  name: string;
  severity: number;
}

interface CorrelationResult {
  symptom: string;
  triggers: string[];
  confidence: number;
  explanation: string;
}

const COMMON_SYMPTOMS_KEYS = ["headache", "fatigue", "bloating", "templePressure", "nausea", "stress", "insomnia"];

export default function SymptomTrackerWidget() {
  const t = useTranslations("medical");
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Correlation state
  const [correlations, setCorrelations] = useState<CorrelationResult[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // Optionally fetch today's symptoms on mount
    const fetchTodaySymptoms = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date().toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("daily_symptoms")
        .select("symptoms")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
        
      if (data && data.symptoms) {
        setSymptoms(data.symptoms);
      }
    };
    fetchTodaySymptoms();
  }, [supabase]);

  const addSymptom = (name: string) => {
    if (!name.trim()) return;
    if (symptoms.find((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setSymptoms([...symptoms, { name, severity: 5 }]);
    setCustomSymptom("");
    setSaveSuccess(false);
  };

  const removeSymptom = (name: string) => {
    setSymptoms(symptoms.filter((s) => s.name !== name));
    setSaveSuccess(false);
  };

  const updateSeverity = (name: string, severity: number) => {
    setSymptoms(symptoms.map((s) => (s.name === name ? { ...s, severity } : s)));
    setSaveSuccess(false);
  };

  const saveDay = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = new Date().toISOString().split("T")[0];

      const { error } = await supabase
        .from("daily_symptoms")
        .upsert({
          user_id: user.id,
          date: today,
          symptoms: symptoms,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving symptoms:", err);
      alert(t("errorSavingSymptoms"));
    } finally {
      setIsSaving(false);
    }
  };

  const generateInsights = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      // NOTE: requires adding correlateSymptoms to apiClient
      const insights = await apiClient.correlateSymptoms();
      setCorrelations(insights);
    } catch (err: any) {
      console.error("Error generating correlations:", err);
      setAnalysisError(err.message || t("errorGeneratingInsights"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Tracker Section */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-ink">{t("symptomsRegistration")}</h2>
        <p className="mb-6 text-sm text-ink-muted">
          {t("symptomsDescription")}
        </p>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-ink">{t("frequentSymptoms")}</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS_KEYS.map((key) => {
              const sym = t(`symptomsList.${key}`);
              return (
              <button
                key={sym}
                onClick={() => addSymptom(sym)}
                disabled={symptoms.some((s) => s.name === sym)}
                className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-sm font-medium text-ink-muted transition hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + {sym}
              </button>
            )})}
          </div>
        </div>

        <div className="mb-8 flex gap-3">
          <input
            type="text"
            value={customSymptom}
            onChange={(e) => setCustomSymptom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSymptom(customSymptom)}
            placeholder={t("customSymptomPlaceholder")}
            className="flex-1 rounded-xl border border-border px-4 py-2 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <button
            onClick={() => addSymptom(customSymptom)}
            className="flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus className="mr-2 h-4 w-4" /> {t("add")}
          </button>
        </div>

        {symptoms.length > 0 && (
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-semibold text-ink">{t("selected")}</h3>
            {symptoms.map((s) => (
              <div key={s.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink">{s.name}</span>
                  <button onClick={() => removeSymptom(s.name)} className="text-xs text-red-500 hover:text-red-700 underline">{t("delete")}</button>
                </div>
                <div className="flex items-center gap-4 flex-1 max-w-xs">
                  <span className="text-xs text-ink-muted w-12 sm:text-right">{t("strengthLabel")} {s.severity}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={s.severity}
                    onChange={(e) => updateSeverity(s.name, parseInt(e.target.value))}
                    className="flex-1 accent-cyan-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={saveDay}
            disabled={isSaving || symptoms.length === 0}
            className="rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-700 disabled:bg-surface-muted disabled:text-ink-muted disabled:border disabled:border-border disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("saveDay")}
          </button>
          {saveSuccess && <span className="text-sm font-medium text-green-600">{t("successfullySaved")}</span>}
        </div>
      </div>

      {/* AI Correlation Section */}
      <div className="rounded-2xl border border-border bg-gradient-to-b from-purple-500/10 to-surface p-6 shadow-sm">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {t("aiCorrelationAnalysis")}
            </h2>
            <p className="mt-2 text-sm text-ink-muted max-w-2xl">
              {t("aiCorrelationDescription")}
            </p>
          </div>
          <button
            onClick={generateInsights}
            disabled={isAnalyzing}
            className="shrink-0 flex items-center justify-center rounded-xl bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_4px_14px_0_rgba(147,51,234,0.39)]"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("analyzing")}
              </>
            ) : (
              t("generateInsights")
            )}
          </button>
        </div>

        {analysisError && (
          <div className="mb-6 rounded-xl bg-red-500/10 p-4 flex items-start gap-3 border border-red-500/20">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{analysisError}</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-purple-500/20 bg-purple-500/10/50 p-5">
                <div className="h-4 w-32 rounded bg-purple-200 mb-4" />
                <div className="h-3 w-full rounded bg-purple-100 mb-2" />
                <div className="h-3 w-4/5 rounded bg-purple-100" />
              </div>
            ))}
          </div>
        )}

        {!isAnalyzing && correlations && correlations.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {correlations.map((corr, idx) => (
              <div key={idx} className="rounded-xl border border-purple-500/20 bg-surface p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-ink text-lg">{corr.symptom}</h3>
                  <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                    {t("confidenceLabel")} {Math.round(corr.confidence * 100)}%
                  </span>
                </div>
                
                <div className="mb-4 flex flex-wrap gap-2">
                  {corr.triggers.map((trigger, i) => (
                    <span key={i} className="rounded-md bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 border border-rose-500/20">
                      {trigger}
                    </span>
                  ))}
                </div>
                
                <div className="rounded-lg bg-surface-muted p-3 text-sm text-ink leading-relaxed">
                  {corr.explanation}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isAnalyzing && correlations && correlations.length === 0 && (
          <div className="rounded-xl border border-border bg-surface-muted p-8 text-center">
            <p className="text-ink-muted text-sm">{t("noCorrelationsFound")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
