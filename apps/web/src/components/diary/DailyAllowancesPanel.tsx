import { useState, useRef, useEffect } from "react";

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

const getMicroLevel = (pct: number) => {
  if (pct < 25) return { color: 'bg-gradient-to-r from-[#FCA5A5] to-[#EF4444]', badgeBg: 'bg-[#FEE2E2]', badgeText: 'text-[#DC2626]', label: '< 25%' };
  if (pct < 50) return { color: 'bg-gradient-to-r from-[#FCD34D] to-[#F59E0B]', badgeBg: 'bg-[#FEF3C7]', badgeText: 'text-[#B45309]', label: 'Low' };
  if (pct < 75) return { color: 'bg-gradient-to-r from-[#93C5FD] to-[#3B82F6]', badgeBg: 'bg-[#DBEAFE]', badgeText: 'text-[#1D4ED8]', label: 'Mid' };
  if (pct < 100) return { color: 'bg-gradient-to-r from-[#6EE7B7] to-[#10B981]', badgeBg: 'bg-[#D1FAE5]', badgeText: 'text-[#047857]', label: 'Good' };
  return { color: 'bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]', badgeBg: 'bg-[#EDE9FE]', badgeText: 'text-[#6D28D9]', label: 'Over' };
};

const NUTRIENT_EMOJI: Record<string, string> = {
  'Витамин C': '🍊', 'Витамин D': '☀️', 'Витамин B6': '🥬', 'Витамин A': '🫐', 
  'Витамин B12': '💊', 'Витамин E': '🌻', 'Фолиевая кислота': '🥦', 
  'Железо': '🔩', 'Кальций': '🦴', 'Калий': '⚡', 'Магний': '🧲', 
  'Цинк': '🔬', 'Селен': '🌰', 'Фосфор': '🧪', 'Натрий': '🧂', 'Омега-3': '🐟'
};

const isVitamin = (name: string) => name.startsWith('Витамин') || name === 'Фолиевая кислота';

export default function DailyAllowancesPanel({
  consumed = { calories: 0, protein: 0, fat: 0, carbs: 0 } as MacrosConfig,
  dynamicTarget = { calories: 2000, protein: 120, fat: 60, carbs: 250 } as MacrosConfig,
  dynamicMicros = {},
  consumedMicros = {},
  rationale = "Базовая норма",
}: Props) {
  const [isMicrosExpanded, setIsMicrosExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const calcPercentSafe = (val: number, max: number) => Math.min(100, Math.max(0, (val / Math.max(max, 1)) * 100));

  const trackedMicros = microsEntries.filter(([name]) => dynamicMicros[name] && dynamicMicros[name] > 0);
  const avgCoverage = trackedMicros.length > 0 
    ? Math.round(trackedMicros.reduce((acc, [name, {value}]) => acc + calcPercentSafe(value, dynamicMicros[name]!), 0) / trackedMicros.length)
    : 0;

  const cCalPercent = calcPercentSafe(consumed.calories, dynamicTarget.calories);
  // Circular calc
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (cCalPercent / 100) * circumference;

  const hasRulesApplied = rationale && rationale !== "Базовая норма (профиль не заполнен)." && rationale !== "Базовая норма";

  const MACROS_CONFIG = [
    {
      label: "БЕЛКИ",
      emoji: "💪",
      value: consumed.protein,
      target: dynamicTarget.protein,
      bg: "bg-[#EFF6FF]",
      text: "text-[#2563EB]",
      gradient: "from-[#60A5FA] to-[#2563EB]",
    },
    {
      label: "ЖИРЫ",
      emoji: "🫒",
      value: consumed.fat,
      target: dynamicTarget.fat,
      bg: "bg-[#FFFBEB]",
      text: "text-[#D97706]",
      gradient: "from-[#FBBF24] to-[#D97706]",
    },
    {
      label: "УГЛЕВОДЫ",
      emoji: "🌾",
      value: consumed.carbs,
      target: dynamicTarget.carbs,
      bg: "bg-[#ECFDF5]",
      text: "text-[#059669]",
      gradient: "from-[#34D399] to-[#059669]",
    }
  ];

  return (
    <div className="bg-surface-muted border-b border-border p-4">
      {/* ── New Modular BJU Block ────────────────────────── */}
      <div className="bg-white rounded-[20px] shadow-sm border border-border overflow-hidden animate-fade-in-up mb-4 mx-1 mt-1">
        {/* Calorie Header */}
        <div className="flex items-center gap-4 px-5 pt-5 pb-1">
          {/* Ring */}
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r={radius}
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-[#FFEDD5]"
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
                className="text-[#F97316] transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-0.5 leading-none mb-0.5">
                <span className="text-[18px] font-[800] text-ink tracking-tight">{Math.round(consumed.calories)}</span>
                <span className="text-[10px]">🔥</span>
              </div>
              <span className="text-[9px] text-ink-muted leading-none">/ {dynamicTarget.calories}</span>
            </div>
          </div>

          {/* Text Info */}
          <div className="flex flex-col gap-0.5">
            <h4 className="text-sm font-bold text-ink">Калории за день</h4>
            <div className="text-xs text-ink-muted">
              Осталось <span className="font-bold text-[#F97316]">{Math.max(0, dynamicTarget.calories - Math.round(consumed.calories))}</span> <span className="font-bold text-[#F97316]">ккал</span>
            </div>
            <div className="text-[11px] text-ink-faint">≈ обед + перекус до нормы</div>
          </div>
        </div>

        {/* Macros Grid */}
        <div className="flex gap-2.5 px-4 pb-4 pt-2">
          {MACROS_CONFIG.map((macro) => {
            const percent = calcPercentSafe(macro.value, macro.target);
            return (
              <div 
                key={macro.label}
                className={`${macro.bg} flex-1 rounded-[14px] p-2.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md cursor-default flex flex-col items-center`}
              >
                <span className="text-lg mb-0.5">{macro.emoji}</span>
                <span className={`text-[9px] font-semibold uppercase tracking-wide ${macro.text}`}>{macro.label}</span>
                <span className="text-[18px] font-[800] text-ink leading-none mt-1">{Math.round(macro.value)}</span>
                <span className="text-[9px] text-ink-muted mb-2"> / {macro.target} г</span>
                
                {/* Progress track */}
                <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                  {/* Progress fill */}
                  <div 
                    className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${macro.gradient}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold mt-1.5 ${macro.text}`}>{Math.round(percent)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Stage 2: Micronutrients Expansion Panel ────────── */}
      <div className="bg-white rounded-[20px] shadow-sm border border-border mt-3.5 mx-1">
        {/* Header */}
        <button 
          onClick={() => setIsMicrosExpanded(!isMicrosExpanded)}
          className="flex w-full items-center justify-between p-4 focus:outline-none hover:bg-surface-muted transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✨</span>
            <div>
              <h4 className="text-[13px] font-bold text-ink leading-tight">Микронутриенты</h4>
              <p className="text-[10px] text-ink-faint">{trackedMicros.length} из 16 отслеживаются</p>
            </div>
          </div>
          <div className={`p-1 transform transition-transform duration-300 ${isMicrosExpanded ? "rotate-180" : ""}`}>
            <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isMicrosExpanded && (
          <div className="px-4 pb-0 pt-1 animate-fade-in">
            <div className="pb-5">
              {/* Overall Score Ring Section */}
            <div className="flex items-center gap-4 py-4 px-3 bg-surface-muted rounded-2xl mb-5">
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 60 60" className="w-full h-full transform -rotate-90">
                  <circle cx="30" cy="30" r="25" stroke="#E2E8F0" strokeWidth="5" fill="none" />
                  <circle 
                    cx="30" cy="30" r="25" stroke="#10B981" strokeWidth="5" fill="none" 
                    strokeDasharray="157" strokeDashoffset={157 - (avgCoverage / 100) * 157} 
                    strokeLinecap="round" className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-[13px] font-bold">{avgCoverage}%</span>
              </div>
              <div>
                <p className="text-[12px] font-bold text-ink">Покрытие дневной нормы</p>
                <p className="text-[10px] text-ink-faint">Среднее значение по всем витаминам и минералам</p>
              </div>
            </div>

            {/* Render 2 categories: ВИТАМИНЫ / МИНЕРАЛЫ */}
            {(['Витамины', 'Минералы'] as const).map(cat => {
              const list = microsEntries.filter(([name]) => (cat === 'Витамины' ? isVitamin(name) : !isVitamin(name)));
              if (list.length === 0) return null;
              
              return (
                <div key={cat} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${cat === 'Витамины' ? 'bg-[#F59E0B]' : 'bg-[#6366F1]'}`} />
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{cat}</h5>
                  </div>
                  
                  <div className="flex flex-col gap-0.5">
                    {list.map(([name, {value, unit}]) => {
                      const target = dynamicMicros[name];
                      // IMPORTANT: Fallback to Math.max(value, 100) if no target, avoid division by zero
                      const safeTarget = target || Math.max(value, 100); 
                      const pct = calcPercentSafe(value, safeTarget);
                      const level = getMicroLevel(pct);
                      return (
                        <div key={name} className="flex items-center justify-between gap-3 py-1.5 px-0.5">
                          {/* 1. Icon (Left) */}
                          <div className={`w-9 h-9 shrink-0 rounded-[12px] flex items-center justify-center text-[18px] shadow-sm bg-white border border-border/50 ${isVitamin(name) ? 'bg-[#FFFBF2]' : 'bg-[#F8FAFC]'}`}>
                            {NUTRIENT_EMOJI[name] || '💊'}
                          </div>

                          {/* 2. Middle Info (Name + Values + Bar) */}
                          <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                            <div className="flex items-end justify-between leading-none mb-1.5 mt-0.5">
                              <span className="text-[14px] font-[700] text-ink truncate mr-2">{name}</span>
                              <span className="text-[13px] font-bold text-ink shrink-0">
                                {Number(value.toFixed(1))} <span className="text-ink-muted font-medium text-[12px]">/ {target || '—'} {unit}</span>
                              </span>
                            </div>
                            <div className="w-full h-[6px] bg-black/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 animate-shimmer ${level.color}`} 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                          </div>

                          {/* 3. Badge (Right) */}
                          <div className={`shrink-0 min-w-[42px] text-center px-1.5 py-1 rounded-md text-[11px] font-[800] ${level.badgeBg} ${level.badgeText}`}>
                            {Math.round(pct)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Footer Legend & Rationale */}
            <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex gap-1">
                {['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'].map(c => (
                  <div key={c} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                ))}
              </div>
              <div ref={tooltipRef} className="relative flex items-center">
                <button 
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="text-[10px] font-bold text-primary-600 flex items-center gap-1 hover:underline"
                >
                  ✧ Моя норма
                </button>
                {showTooltip && (
                  <div className="absolute right-0 bottom-full mb-3 w-[260px] p-3.5 rounded-xl bg-ink/95 backdrop-blur-md text-white shadow-xl pointer-events-auto z-50 transform origin-bottom-right transition-all">
                    <div className="text-[11px] font-bold text-white/90 mb-2 border-b border-white/10 pb-2">
                        Индивидуальные корректировки:
                    </div>
                    {rationale ? (
                      <ul className="flex flex-col gap-2">
                         {/* Parse the rationale string, splitting primarily by '),' to capture full medical reasoning without breaking internal parentheses */}
                        {rationale.split('),').map((item, i, arr) => {
                          const cleanItem = item.trim() + (i !== arr.length - 1 ? ')' : '');
                          if (!cleanItem || cleanItem.includes('Базовая норма')) return null;
                          
                          // Optional: Extract the medical condition vs the vitamin mapping
                          // Format: Condition [severity] (+Vitamins)
                          const parts = cleanItem.split(' (+');
                          const condition = parts[0].replace('⚕️', '').trim();
                          const vitamins = parts[1] ? parts[1].replace(')', '').trim() : '';

                          return (
                            <li key={i} className="flex items-start gap-2 text-[11px] leading-tight">
                              <span className="text-primary-400 mt-0.5 shrink-0 text-[10px]">⚕️</span>
                              <div>
                                <span className="text-white/90 block">{condition}</span>
                                {vitamins && <span className="text-primary-300 font-bold block mt-0.5 text-[10px]">+{vitamins}</span>}
                              </div>
                            </li>
                          );
                        })}
                        {rationale.includes('Базовая норма') && (
                           <li className="text-white/70 text-[10px]">Базовая норма (отклонений из анализов не найдено).</li>
                        )}
                      </ul>
                    ) : (
                      <div className="text-[10px] text-white/70 leading-relaxed">
                        Ваша норма рассчитана ИИ на основе базового профиля.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

    </div>
  );
}
