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


    </div>
  );
}
