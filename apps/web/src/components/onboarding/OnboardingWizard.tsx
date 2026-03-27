"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const SECTIONS = [
  { id: "basic", title: "Базовые метрики" },
  { id: "sleep", title: "Сон и Режим" },
  { id: "environment", title: "Среда и Локация" },
  { id: "activity", title: "Активность" },
  { id: "diet", title: "Питание" },
  { id: "medical", title: "Анамнез" },
  { id: "stress", title: "Стресс" },
  { id: "exterior", title: "Внешние маркеры" },
];

export default function OnboardingWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

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
      };

      // Biological Sex
      if (formData.sex === "Мужской") mappedData.biological_sex = "male";
      else if (formData.sex === "Женский") mappedData.biological_sex = "female";

      // Age to Date of Birth (approximate)
      if (formData.age) {
        const currentYear = new Date().getFullYear();
        const birthYear = currentYear - parseInt(formData.age, 10);
        mappedData.date_of_birth = `${birthYear}-01-01`;
      }

      // Physics
      if (formData.height) mappedData.height_cm = parseFloat(formData.height);
      if (formData.weight) mappedData.weight_kg = parseFloat(formData.weight);

      // Activity Level
      const activityMap: Record<string, string> = {
        "Сидячий": "sedentary",
        "Легкий": "light",
        "Средний": "moderate",
        "Высокий": "active"
      };
      if (formData.activity) mappedData.activity_level = activityMap[formData.activity];

      // Diet Type
      const dietMap: Record<string, string> = {
        "Всеядное": "omnivore",
        "Вегетарианство": "vegetarian",
        "Кето": "keto",
        "Палео": "other"
      };
      if (formData.diet_type) mappedData.diet_type = dietMap[formData.diet_type];

      // Climate Zone
      const climateMap: Record<string, string> = {
        "Умеренная": "temperate",
        "Тропики": "tropical",
        "Холодная": "polar"
      };
      if (formData.climate) mappedData.climate_zone = climateMap[formData.climate];

      // Stress Level (Mapping 1-10 to low/moderate/high/very_high)
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
      alert("Ошибка при сохранении профиля");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Добро пожаловать в VITOGRAPH
        </h1>
        <p className="mt-2 text-ink-muted">
          Давайте настроим ваш профиль (Шаг {currentStep + 1} из {SECTIONS.length})
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-ink">
          {SECTIONS[currentStep].title}
        </h2>

        <div className="space-y-4">
          {/* We will dynamically render simple inputs based on the step. 
              For the MVP, we render generic text inputs for demonstration to map to the 50 markers. */}
          
          {currentStep === 0 && (
            <>
              <InputField label="Возраст" value={formData.age || ""} onChange={(v) => updateField("age", v)} type="number" />
              <SelectField label="Пол" value={formData.sex || ""} options={["Мужской", "Женский"]} onChange={(v) => updateField("sex", v)} />
              <InputField label="Рост (см)" value={formData.height || ""} onChange={(v) => updateField("height", v)} type="number" />
              <InputField label="Вес (кг)" value={formData.weight || ""} onChange={(v) => updateField("weight", v)} type="number" />
              <SelectField label="Текущая цель" value={formData.goal || ""} options={["Похудение", "Набор", "Баланс"]} onChange={(v) => updateField("goal", v)} />
            </>
          )}

          {currentStep === 1 && (
            <>
              <InputField label="Время отхода ко сну" value={formData.bedtime || ""} onChange={(v) => updateField("bedtime", v)} type="time" />
              <InputField label="Среднее время сна (часов)" value={formData.sleep_hours || ""} onChange={(v) => updateField("sleep_hours", v)} type="number" />
              <SelectField label="Качество сна" value={formData.sleep_quality || ""} options={["Хорошее", "Среднее", "Плохое"]} onChange={(v) => updateField("sleep_quality", v)} />
            </>
          )}

          {currentStep === 2 && (
            <>
              <SelectField label="Климатическая зона" value={formData.climate || ""} options={["Умеренная", "Тропики", "Холодная"]} onChange={(v) => updateField("climate", v)} />
              <SelectField label="Экология" value={formData.pollution || ""} options={["Мегаполис", "Пригород", "Деревня"]} onChange={(v) => updateField("pollution", v)} />
            </>
          )}

          {currentStep === 3 && (
             <>
               <SelectField label="Уровень активности" value={formData.activity || ""} options={["Сидячий", "Легкий", "Средний", "Высокий"]} onChange={(v) => updateField("activity", v)} />
               <InputField label="Тренировок в неделю" value={formData.workouts_per_week || ""} onChange={(v) => updateField("workouts_per_week", v)} type="number" />
             </>
          )}
          
          {currentStep === 4 && (
             <>
               <SelectField label="Тип питания" value={formData.diet_type || ""} options={["Всеядное", "Вегетарианство", "Кето", "Палео"]} onChange={(v) => updateField("diet_type", v)} />
               <InputField label="Аллергии (через запятую)" value={formData.allergies || ""} onChange={(v) => updateField("allergies", v)} />
             </>
          )}

           {currentStep === 5 && (
             <>
               <InputField label="Хронические заболевания" value={formData.chronic_conditions || ""} onChange={(v) => updateField("chronic_conditions", v)} />
               <InputField label="Принимаемые БАДы" value={formData.supplements || ""} onChange={(v) => updateField("supplements", v)} />
             </>
          )}

          {currentStep === 6 && (
             <>
               <SelectField label="Ваш субъективный уровень стресса (1-10)" value={formData.stress_level || ""} options={["1","2","3","4","5","6","7","8","9","10"]} onChange={(v) => updateField("stress_level", v)} />
               <InputField label="Частые перепады настроения? (Да/Нет)" value={formData.mood_swings || ""} onChange={(v) => updateField("mood_swings", v)} />
             </>
          )}

          {currentStep === 7 && (
             <>
               <InputField label="Состояние кожи (сухость, акне)" value={formData.skin_condition || ""} onChange={(v) => updateField("skin_condition", v)} />
               <InputField label="Склонность к отекам (Да/Нет)" value={formData.edema || ""} onChange={(v) => updateField("edema", v)} />
             </>
          )}

        </div>

        <div className="mt-8 flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0 || isSubmitting}
            className="rounded-lg px-4 py-2 text-ink-muted hover:bg-cloud disabled:opacity-50"
          >
            Назад
          </button>
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="rounded-lg bg-primary-600 px-6 py-2 text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {currentStep === SECTIONS.length - 1 ? (isSubmitting ? "Сохранение..." : "Завершить") : "Далее"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Simple Reusable Input Components ─────────────────────────

function InputField({ label, value, onChange, type = "text" }: { label: string, value: string | number, onChange: (val: string) => void, type?: string }) {
  return (
    <div>
      <label className="mb-1 text-sm font-medium text-ink-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-cloud-dark px-3 py-2 text-ink shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string, value: string, options: string[], onChange: (val: string) => void }) {
  return (
    <div>
      <label className="mb-1 text-sm font-medium text-ink-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-cloud-dark px-3 py-2 text-ink shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        <option value="" disabled>Выберите...</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
