import { useState } from "react";

type MacrosConfig = { calories: number; protein: number; fat: number; carbs: number };

const MICRONUTRIENT_NAME_MAPPING: Record<string, string> = {
  'vitamin c': 'Витамин C',
  'vitamin c (mg)': 'Витамин C',
  'iron': 'Железо',
  'iron (mg)': 'Железо',
  'vitamin d': 'Витамин D',
  'vitamin d (iu)': 'Витамин D',
  'vitamin d (mcg)': 'Витамин D',
  'vitamin b12': 'Витамин B12',
  'vitamin b12 (mcg)': 'Витамин B12',
  'vitamin b6': 'Витамин B6',
  'vitamin b6 (mg)': 'Витамин B6',
  'vitamin a': 'Витамин A',
  'vitamin a (mcg)': 'Витамин A',
  'vitamin a (iu)': 'Витамин A',
  'vitamin e': 'Витамин E',
  'vitamin e (mg)': 'Витамин E',
  'folate': 'Фолиевая кислота',
  'folic acid': 'Фолиевая кислота',
  'folate (mcg)': 'Фолиевая кислота',
  'calcium': 'Кальций',
  'calcium (mg)': 'Кальций',
  'magnesium': 'Магний',
  'magnesium (mg)': 'Магний',
  'zinc': 'Цинк',
  'zinc (mg)': 'Цинк',
  'selenium': 'Селен',
  'selenium (mcg)': 'Селен',
  'iodine': 'Йод',
  'iodine (mcg)': 'Йод',
  'potassium': 'Калий',
  'potassium (mg)': 'Калий',
  'sodium': 'Натрий',
  'sodium (mg)': 'Натрий',
  'phosphorus': 'Фосфор',
  'phosphorus (mg)': 'Фосфор',
  'oemga-3': 'Омега-3',
  'omega-3': 'Омега-3',
  'omega 3': 'Омега-3',
  'dha': 'Омега-3',
  'epa': 'Омега-3',
  'витамин c': 'Витамин C',
  'витамин c (мг)': 'Витамин C',
  'витамин c (mg)': 'Витамин C',
  'витамин а': 'Витамин A',
  'витамин е': 'Витамин E',
  'витамин д': 'Витамин D',
  'железо': 'Железо',
  'железо (мг)': 'Железо',
  'железо (mg)': 'Железо',
  'калий (mg)': 'Калий',
  'магний (mg)': 'Магний',
  'натрий (mg)': 'Натрий',
  'кальций (mg)': 'Кальций',
  'кальций (мг)': 'Кальций',
  'цинк (mg)': 'Цинк',
  'фосфор (mg)': 'Фосфор',
};

const normalizeMicronutrientKey = (rawKey: string): string => {
  const lowerKey = rawKey.toLowerCase().trim();
  if (MICRONUTRIENT_NAME_MAPPING[lowerKey]) {
    return MICRONUTRIENT_NAME_MAPPING[lowerKey];
  }
  return rawKey.split(' (')[0].trim();
};

interface Props {
  consumed?: MacrosConfig;
  dynamicTarget?: MacrosConfig;
  dynamicMicros?: Record<string, number>;
  consumedMicros?: Record<string, number>;
  rationale?: string;
}

export default function DailyAllowancesPanel({
  consumed = { calories: 0, protein: 0, fat: 0, carbs: 0 } as MacrosConfig,
  dynamicTarget = { calories: 2000, protein: 120, fat: 60, carbs: 250 } as MacrosConfig,
  dynamicMicros = {},
  consumedMicros = {},
  rationale = "Базовая норма",
}: Props) {
  const [isMicrosExpanded, setIsMicrosExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Normalize and group consumed micros to match dynamicMicros keys
  const normalizedConsumed: Record<string, { value: number; unit: string }> = {};

  Object.entries(consumedMicros).forEach(([rawKey, val]) => {
    if (val <= 0) return;
    const normalizedKey = normalizeMicronutrientKey(rawKey);
    const unit = rawKey.match(/\((.*?)\)/)?.[1] || "";

    if (!normalizedConsumed[normalizedKey]) {
      normalizedConsumed[normalizedKey] = { value: 0, unit };
    }
    normalizedConsumed[normalizedKey].value += val;
    if (!normalizedConsumed[normalizedKey].unit && unit) {
      normalizedConsumed[normalizedKey].unit = unit;
    }
  });

  const microsEntries = Object.entries(normalizedConsumed);

  const calcPercent = (val: number, max: number) => Math.min(100, Math.max(0, (val / max) * 100));

  const getColor = (percent: number) => {
    if (percent < 90) return 'bg-green-500'; // Or primary-500
    if (percent <= 105) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStrokeColor = (percent: number) => {
    if (percent < 90) return 'text-primary-500';
    if (percent <= 105) return 'text-yellow-500';
    return 'text-red-500';
  };

  const cCalPercent = calcPercent(consumed.calories, dynamicTarget.calories);
  // Circular calc
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (cCalPercent / 100) * circumference;

  const hasRulesApplied = rationale && rationale !== "Базовая норма (профиль не заполнен)." && rationale !== "Базовая норма";

  return (
    <div className="bg-surface-muted border-b border-border p-4">
      {/* Top Flex for Calories & Macros */}
      <div className="flex gap-6 items-center flex-wrap sm:flex-nowrap relative">
        {/* Calories - Circular Progress */}
        <div className="relative flex flex-col items-center justify-center min-w-[80px]">
          <svg className="transform -rotate-90 w-20 h-20">
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-cloud-dark"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className={`${getStrokeColor(cCalPercent)} transition-all duration-500 ease-out`}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-ink leading-none">{Math.round(consumed.calories)}</span>
            <span className="text-[10px] text-ink-faint">/ {dynamicTarget.calories}</span>
          </div>
          <span className="text-[10px] uppercase font-semibold text-ink-muted mt-1 tracking-wider">Ккал</span>
        </div>

        {/* Macros - Linear Progress */}
        <div className="flex-1 space-y-3 min-w-[200px] mt-4 sm:mt-0">

          {/* Protein */}
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-semibold text-ink-muted">Белки</span>
              <span className="text-xs font-semibold text-ink">{Math.round(consumed.protein)} <span className="text-[10px] font-normal text-ink-faint">/ {dynamicTarget.protein}г</span></span>
            </div>
            <div className="h-2 w-full bg-cloud-dark rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${getColor(calcPercent(consumed.protein, dynamicTarget.protein))}`} style={{ width: `${calcPercent(consumed.protein, dynamicTarget.protein)}%` }} />
            </div>
          </div>

          {/* Fats */}
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-semibold text-ink-muted">Жиры</span>
              <span className="text-xs font-semibold text-ink">{Math.round(consumed.fat)} <span className="text-[10px] font-normal text-ink-faint">/ {dynamicTarget.fat}г</span></span>
            </div>
            <div className="h-2 w-full bg-cloud-dark rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${getColor(calcPercent(consumed.fat, dynamicTarget.fat))}`} style={{ width: `${calcPercent(consumed.fat, dynamicTarget.fat)}%` }} />
            </div>
          </div>

          {/* Carbs */}
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-1">
              <span className="text-xs font-semibold text-ink-muted">Углеводы</span>
              <span className="text-xs font-semibold text-ink">{Math.round(consumed.carbs)} <span className="text-[10px] font-normal text-ink-faint">/ {dynamicTarget.carbs}г</span></span>
            </div>
            <div className="h-2 w-full bg-cloud-dark rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${getColor(calcPercent(consumed.carbs, dynamicTarget.carbs))}`} style={{ width: `${calcPercent(consumed.carbs, dynamicTarget.carbs)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Micronutrients Toggle */}
      <div className="mt-4 border-t border-border pt-1">
        <button
          onClick={() => setIsMicrosExpanded(!isMicrosExpanded)}
          className="flex w-full items-center justify-between py-2 px-3 -mx-3 rounded-2xl hover:bg-surface transition-colors group focus:outline-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-500/10 text-primary-500 group-hover:scale-110 transition-transform">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-ink group-hover:text-primary-600 transition-colors">Микронутриенты (Витамины и Минералы)</span>
          </div>
          <div className={`p-1 rounded-full bg-cloud-dark/30 text-ink-muted group-hover:bg-primary-500/10 group-hover:text-primary-500 transform transition-all duration-300 ${isMicrosExpanded ? "rotate-180" : ""}`}>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Micronutrients List */}
        {isMicrosExpanded && (
          <div className="mt-2 animate-slide-up pb-2 px-1">
            {microsEntries.length > 0 ? (
              <div className="flex flex-col gap-2.5 mt-2">
                {microsEntries.map(([name, { value: val, unit }]) => {
                  const targetMicro = dynamicMicros[name];
                  const maxVal = targetMicro || Math.max(val, 100);
                  const percent = Math.min(100, (val / maxVal) * 100);
                  const isOverload = targetMicro && val > targetMicro;

                  return (
                    <div key={name} className="flex items-center gap-3 text-[11px] w-full">
                      <span className="w-1/3 text-ink-muted truncate" title={name}>{name}</span>

                      <div className="flex-1 h-1.5 bg-cloud-dark rounded-full overflow-hidden">
                        {targetMicro ? (
                          <div
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${isOverload ? 'bg-orange-400' : 'bg-primary-500'}`}
                            style={{ width: `${percent}%` }}
                          />
                        ) : (
                          <div className="h-full bg-cloud-darker w-full opacity-50" title="Норма неизвестна" />
                        )}
                      </div>

                      <span className="w-1/3 text-right text-ink font-medium">
                        {Math.round(val * 10) / 10} {targetMicro ? <span className="text-ink-faint font-normal">/ {targetMicro} {unit}</span> : <span className="text-ink-faint font-normal">{unit}</span>}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 w-full mt-1">
                  <span className="w-1/3"></span>
                  <div className="flex-1"></div>
                  <div className="w-1/2 text-right flex justify-end items-center">
                    {hasRulesApplied ? (
                      <div className="inline-flex items-center gap-1.5 py-0.5 px-2 bg-primary-100 text-primary-700 rounded-full text-[10px] font-semibold group relative">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Индивидуальная норма
                        <div
                          className="relative flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary-200 text-primary-800 font-bold ml-0.5 cursor-help"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowTooltip(!showTooltip);
                          }}
                          onMouseEnter={() => setShowTooltip(true)}
                          onMouseLeave={() => setShowTooltip(false)}
                        >
                          i
                          {showTooltip && (
                            <div className="absolute right-0 bottom-full mb-2 w-48 sm:w-64 p-3 rounded-xl bg-ink text-surface text-[11px] font-normal leading-relaxed text-left shadow-xl pointer-events-none animate-fade-in z-50">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex h-2 w-2 rounded-full bg-primary-400"></span>
                                <span className="font-semibold text-white">AI-расчет</span>
                              </div>
                              {rationale}
                              <svg className="absolute text-ink h-2 w-auto right-1 top-full" viewBox="0 0 255 255"><polygon className="fill-current" points="0,0 127.5,127.5 255,0" /></svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-ink-faint">
                        * Базовая норма
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-ink-faint text-center py-4 rounded-xl bg-surface-muted/50 border border-dashed border-border mt-3">
                <div className="mb-1 text-base">🍽️</div>
                Нет данных о микронутриентах за сегодня.<br />Добавьте приемы пищи, чтобы ИИ мог их рассчитать.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
