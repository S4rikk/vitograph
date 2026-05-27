"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus } from "lucide-react";
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
              const isSelected = symptoms.some((s) => s.name === sym);
              return (
              <button
                key={sym}
                onClick={() => addSymptom(sym)}
                disabled={isSelected}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed ${
                  isSelected
                    ? "border border-emerald-400 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3),0_0_15px_rgba(16,185,129,0.6)] animate-pulse"
                    : "border border-white/70 dark:border-white/30 bg-surface/80 text-ink-muted backdrop-blur-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),inset_1px_0_2px_rgba(255,255,255,0.5),inset_-1px_0_2px_rgba(255,255,255,0.5),inset_0_-1px_2px_rgba(255,255,255,0.2),0_10px_20px_-10px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_1px_0_2px_rgba(255,255,255,0.15),inset_-1px_0_2px_rgba(255,255,255,0.15),inset_0_-1px_2px_rgba(255,255,255,0.05),0_10px_20px_-10px_rgba(0,0,0,0.5)] hover:brightness-110"
                }`}
              >
                {isSelected ? "✓" : "+"} {sym}
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
          <div className="space-y-2 mb-6">
            <h3 className="text-sm font-semibold text-ink mb-1">{t("selected")}</h3>
            {symptoms.map((s) => (
              <div key={s.name} className="flex flex-col gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.2),0_4px_12px_rgba(16,185,129,0.05)] p-3 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{s.name}</span>
                  <button onClick={() => removeSymptom(s.name)} className="text-[10px] font-bold uppercase tracking-wider text-red-500/90 hover:text-red-500 transition-colors bg-red-500/10 px-2 py-1 rounded-md">{t("delete")}</button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-ink-muted whitespace-nowrap min-w-[50px]">{t("strengthLabel")} {s.severity}</span>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={s.severity}
                    onChange={(e) => updateSeverity(s.name, parseInt(e.target.value))}
                    className="flex-1 accent-emerald-500"
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
            className="group relative flex items-center justify-center overflow-hidden rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-6 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 backdrop-blur-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.1),0_4px_12px_rgba(16,185,129,0.15)] transition-all duration-300 hover:bg-emerald-500/25 hover:border-emerald-400/60 hover:shadow-[inset_0_1px_4px_rgba(255,255,255,0.2),0_6px_16px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none"
          >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
            
            <span className="relative flex items-center gap-2">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("saveDay")}
            </span>
          </button>
          {saveSuccess && <span className="text-sm font-medium text-green-600">{t("successfullySaved")}</span>}
        </div>
      </div>


    </div>
  );
}
