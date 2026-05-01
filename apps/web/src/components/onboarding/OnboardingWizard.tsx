"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useUnits } from "@/hooks/useUnits";

export default function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const tUnits = useTranslations("units");
  const locale = useLocale();
  const u = useUnits();

  const SECTIONS = [
    { id: "basic", title: t("sections.basic") },
    { id: "sleep", title: t("sections.sleep") },
    { id: "environment", title: t("sections.environment") },
    { id: "activity", title: t("sections.activity") },
    { id: "diet", title: t("sections.diet") },
    { id: "medical", title: t("sections.medical") },
    { id: "stress", title: t("sections.stress") },
    { id: "exterior", title: t("sections.exterior") },
  ];

  const handleNext = () => {
    if (currentStep < SECTIONS.length - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      submitProfile();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((p) => p - 1);
  };

  const submitProfile = async () => {
    setIsSubmitting(true);
    try {
      // Map UI values to DB schema constants (English literals)
      const mappedData: Record<string, any> = {
        id: userId,
        lifestyle_markers: formData, // Keep the original JSONB for legacy/detail
        locale: locale, // CRITICAL: Save user's current locale so AI/Push can read it
      };

      // Biological Sex
      if (formData.sex) mappedData.biological_sex = formData.sex;

      // Age to Date of Birth (approximate)
      if (formData.age) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - parseInt(formData.age, 10);
        mappedData.date_of_birth = `${birthYear}-01-01`;
      }

      // Physics
      if (formData.height) {
        if (u.isImperial) {
          // height might be something like "5.11" for 5 ft 11 in
          const parts = String(formData.height).split(".");
          const ft = parseInt(parts[0] || "0", 10);
          const inc = parseInt(parts[1] || "0", 10);
          mappedData.height_cm = u.parseHeightImperial(ft, inc);
        } else {
          mappedData.height_cm = parseFloat(formData.height);
        }
      }
      
      if (formData.weight) {
        const w = parseFloat(formData.weight);
        mappedData.weight_kg = u.parseWeight(w);
      }

      if (formData.activity) mappedData.activity_level = formData.activity;
      if (formData.diet_type) mappedData.diet_type = formData.diet_type;
      if (formData.climate) mappedData.climate_zone = formData.climate;

      if (formData.stress_level) {
        const stress = parseInt(formData.stress_level, 10);
        if (stress <= 3) mappedData.stress_level = "low";
        else if (stress <= 6) mappedData.stress_level = "moderate";
        else if (stress <= 8) mappedData.stress_level = "high";
        else mappedData.stress_level = "very_high";
      }

      const { error } = await supabase
        .from("profiles")
        .upsert(mappedData);

      if (error) throw error;
      
      // Force refresh to re-run server side checks in page.tsx
      router.refresh(); 
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert(t("saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const skipOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ 
           id: userId, 
           lifestyle_markers: { onboarding_skipped: true },
           locale: locale
        });
      if (error) throw error;
      router.refresh(); 
    } catch (err) {
      console.error("Failed to skip onboarding:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const cleanLabel = (text: string) => text.replace(/\s*\(кг\)/i, "").replace(/\s*\(см\)/i, "");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          {t("welcome")}
        </h1>
        <p className="mt-2 text-ink-muted">
          {t("stepOf", { current: currentStep + 1, total: SECTIONS.length })}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-ink">
          {SECTIONS[currentStep].title}
        </h2>

        <div className="space-y-4">
          {currentStep === 0 && (
            <>
              <InputField label={t("fields.age")} value={formData.age || ""} onChange={(v) => updateField("age", v)} type="number" />
              <SelectField label={t("fields.sex")} value={formData.sex || ""} options={[
                { value: "male", label: t("fields.sexOptions.male") },
                { value: "female", label: t("fields.sexOptions.female") },
              ]} onChange={(v) => updateField("sex", v)} tCommon={tCommon} />
              
              <InputField label={`${cleanLabel(t("fields.height"))} (${tUnits(u.heightUnitKey)})`} value={formData.height || ""} onChange={(v) => updateField("height", v)} type="number" step="0.01" />
              <InputField label={`${cleanLabel(t("fields.weight"))} (${tUnits(u.weightUnitKey)})`} value={formData.weight || ""} onChange={(v) => updateField("weight", v)} type="number" step="0.1" />
              
              <SelectField label={t("fields.goal")} value={formData.goal || ""} options={[
                { value: "loss", label: t("fields.goalOptions.loss") },
                { value: "gain", label: t("fields.goalOptions.gain") },
                { value: "balance", label: t("fields.goalOptions.balance") },
              ]} onChange={(v) => updateField("goal", v)} tCommon={tCommon} />
            </>
          )}

          {currentStep === 1 && (
            <>
              <InputField label={t("fields.bedtime")} value={formData.bedtime || ""} onChange={(v) => updateField("bedtime", v)} type="time" />
              <InputField label={t("fields.sleepHours")} value={formData.sleep_hours || ""} onChange={(v) => updateField("sleep_hours", v)} type="number" />
              <SelectField label={t("fields.sleepQuality")} value={formData.sleep_quality || ""} options={[
                { value: "good", label: t("fields.sleepQualityOptions.good") },
                { value: "average", label: t("fields.sleepQualityOptions.average") },
                { value: "poor", label: t("fields.sleepQualityOptions.poor") }
              ]} onChange={(v) => updateField("sleep_quality", v)} tCommon={tCommon} />
            </>
          )}

          {currentStep === 2 && (
            <>
              <SelectField label={t("fields.climate")} value={formData.climate || ""} options={[
                { value: "temperate", label: t("fields.climateOptions.temperate") },
                { value: "tropical", label: t("fields.climateOptions.tropical") },
                { value: "polar", label: t("fields.climateOptions.cold") }
              ]} onChange={(v) => updateField("climate", v)} tCommon={tCommon} />
              <SelectField label={t("fields.ecology")} value={formData.pollution || ""} options={[
                { value: "megacity", label: t("fields.ecologyOptions.megacity") },
                { value: "suburb", label: t("fields.ecologyOptions.suburb") },
                { value: "village", label: t("fields.ecologyOptions.village") }
              ]} onChange={(v) => updateField("pollution", v)} tCommon={tCommon} />
            </>
          )}

          {currentStep === 3 && (
             <>
               <SelectField label={t("fields.activity")} value={formData.activity || ""} options={[
                 { value: "sedentary", label: t("fields.activityOptions.sedentary") },
                 { value: "light", label: t("fields.activityOptions.light") },
                 { value: "moderate", label: t("fields.activityOptions.moderate") },
                 { value: "active", label: t("fields.activityOptions.active") }
               ]} onChange={(v) => updateField("activity", v)} tCommon={tCommon} />
               <InputField label={t("fields.workoutsPerWeek")} value={formData.workouts_per_week || ""} onChange={(v) => updateField("workouts_per_week", v)} type="number" />
             </>
          )}
          
          {currentStep === 4 && (
             <>
               <SelectField label={t("fields.dietType")} value={formData.diet_type || ""} options={[
                 { value: "omnivore", label: t("fields.dietOptions.omnivore") },
                 { value: "vegetarian", label: t("fields.dietOptions.vegetarian") },
                 { value: "keto", label: t("fields.dietOptions.keto") },
                 { value: "paleo", label: t("fields.dietOptions.paleo") }
               ]} onChange={(v) => updateField("diet_type", v)} tCommon={tCommon} />
               <InputField label={t("fields.allergies")} value={formData.allergies || ""} onChange={(v) => updateField("allergies", v)} />
             </>
          )}

           {currentStep === 5 && (
             <>
               <InputField label={t("fields.chronicConditions")} value={formData.chronic_conditions || ""} onChange={(v) => updateField("chronic_conditions", v)} />
               <InputField label={t("fields.supplements")} value={formData.supplements || ""} onChange={(v) => updateField("supplements", v)} />
             </>
          )}

          {currentStep === 6 && (
             <>
               <SelectField label={t("fields.stressLevel")} value={formData.stress_level || ""} options={[
                 { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" },
                 { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "6", label: "6" },
                 { value: "7", label: "7" }, { value: "8", label: "8" }, { value: "9", label: "9" },
                 { value: "10", label: "10" }
               ]} onChange={(v) => updateField("stress_level", v)} tCommon={tCommon} />
               <InputField label={t("fields.moodSwings")} value={formData.mood_swings || ""} onChange={(v) => updateField("mood_swings", v)} />
             </>
          )}

          {currentStep === 7 && (
             <>
               <InputField label={t("fields.skinCondition")} value={formData.skin_condition || ""} onChange={(v) => updateField("skin_condition", v)} />
               <InputField label={t("fields.edema")} value={formData.edema || ""} onChange={(v) => updateField("edema", v)} />
             </>
          )}

        </div>

        <div className="mt-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              className="rounded-lg px-4 py-2 text-ink-muted hover:bg-cloud disabled:opacity-50"
            >
              {tCommon("back")}
            </button>
            <button
              onClick={skipOnboarding}
              disabled={isSubmitting}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-50"
            >
              {tCommon("skipOnboarding")}
            </button>
          </div>
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="rounded-lg bg-primary-600 px-6 py-2 text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {currentStep === SECTIONS.length - 1 ? (isSubmitting ? tCommon("saving") : tCommon("finish")) : tCommon("next")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Simple Reusable Input Components ─────────────────────────

function InputField({ label, value, onChange, type = "text", step }: { label: string, value: string | number, onChange: (val: string) => void, type?: string, step?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink-muted">{label}</label>
      <input
        type={type}
        value={value}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-cloud-dark px-3 py-2 text-ink shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange, tCommon }: { label: string, value: string, options: { value: string, label: string }[], onChange: (val: string) => void, tCommon: any }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-cloud-dark px-3 py-2 text-ink shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-surface"
      >
        <option value="" disabled>{tCommon("select")}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
