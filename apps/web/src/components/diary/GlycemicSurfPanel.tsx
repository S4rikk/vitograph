"use client";

import { useState, useRef, useEffect } from "react";
import { TrendingUp, Timer, Target, Activity, Info } from "lucide-react";
import SupplementChecklistWidget from "@/components/shared/SupplementChecklistWidget";
import GlycemicCurveChart from "./GlycemicCurveChart";
import { apiClient } from "@/lib/api-client";
import type { GlycemicTimelineData } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// ── Reused Micronutrient Logic (from DailyAllowancesPanel) ──────────

const MICRONUTRIENT_NAME_MAPPING: Record<string, string> = {
  'vitamin c': 'Витамин C', 'vitamin c (mg)': 'Витамин C',
  'iron': 'Железо', 'iron (mg)': 'Железо',
  'vitamin d': 'Витамин D', 'vitamin d (iu)': 'Витамин D', 'vitamin d (mcg)': 'Витамин D',
  'vitamin b12': 'Витамин B12', 'vitamin b12 (mcg)': 'Витамин B12',
  'vitamin b6': 'Витамин B6', 'vitamin b6 (mg)': 'Витамин B6',
  'vitamin a': 'Витамин A', 'vitamin a (mcg)': 'Витамин A', 'vitamin a (iu)': 'Витамин A',
  'vitamin e': 'Витамин E', 'vitamin e (mg)': 'Витамин E',
  'folate': 'Фолиевая кислота', 'folic acid': 'Фолиевая кислота', 'folate (mcg)': 'Фолиевая кислота',
  'calcium': 'Кальций', 'calcium (mg)': 'Кальций',
  'magnesium': 'Магний', 'magnesium (mg)': 'Магний',
  'zinc': 'Цинк', 'zinc (mg)': 'Цинк',
  'selenium': 'Селен', 'selenium (mcg)': 'Селен',
  'iodine': 'Йод', 'iodine (mcg)': 'Йод',
  'potassium': 'Калий', 'potassium (mg)': 'Калий',
  'sodium': 'Натрий', 'sodium (mg)': 'Натрий',
  'phosphorus': 'Фосфор', 'phosphorus (mg)': 'Фосфор',
  'oemga-3': 'Омега-3', 'omega-3': 'Омега-3', 'omega 3': 'Омега-3', 'dha': 'Омега-3', 'epa': 'Омега-3',
  'витамин c': 'Витамин C', 'витамин c (мг)': 'Витамин C', 'витамин c (mg)': 'Витамин C',
  'витамин а': 'Витамин A', 'витамин е': 'Витамин E', 'витамин д': 'Витамин D',
  'железо': 'Железо', 'железо (мг)': 'Железо', 'железо (mg)': 'Железо',
  'калий (mg)': 'Калий', 'магний (mg)': 'Магний', 'натрий (mg)': 'Натрий',
  'кальций (mg)': 'Кальций', 'кальций (мг)': 'Кальций', 'цинк (mg)': 'Цинк', 'фосфор (mg)': 'Фосфор',
};

const normalizeMicronutrientKey = (rawKey: string): string => {
  const lowerKey = rawKey.toLowerCase().trim();
  if (MICRONUTRIENT_NAME_MAPPING[lowerKey]) return MICRONUTRIENT_NAME_MAPPING[lowerKey];
  return rawKey.split(' (')[0].trim();
};

const getMicroLevel = (pct: number) => {
  if (pct < 25) return { color: 'bg-gradient-to-r from-[#FCA5A5] to-[#EF4444]', badgeBg: 'bg-[#FEE2E2]', badgeText: 'text-[#DC2626]', label: '< 25%', isOverdose: false };
  if (pct < 50) return { color: 'bg-gradient-to-r from-[#FCD34D] to-[#F59E0B]', badgeBg: 'bg-[#FEF3C7]', badgeText: 'text-[#B45309]', label: 'Low', isOverdose: false };
  if (pct < 75) return { color: 'bg-gradient-to-r from-[#93C5FD] to-[#3B82F6]', badgeBg: 'bg-[#DBEAFE]', badgeText: 'text-[#1D4ED8]', label: 'Mid', isOverdose: false };
  if (pct < 100) return { color: 'bg-gradient-to-r from-[#6EE7B7] to-[#10B981]', badgeBg: 'bg-[#D1FAE5]', badgeText: 'text-[#047857]', label: 'Good', isOverdose: false };
  return { color: 'bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]', badgeBg: 'bg-[#EDE9FE] animate-pulse-border ring-1 ring-red-500/50', badgeText: 'text-[#6D28D9]', label: 'Over', isOverdose: true };
};

const NUTRIENT_EMOJI: Record<string, string> = {
  'Витамин C': '🍊', 'Витамин D': '☀️', 'Витамин B6': '🥬', 'Витамин A': '🫐',
  'Витамин B12': '💊', 'Витамин E': '🌻', 'Фолиевая кислота': '🥦',
  'Железо': '🔩', 'Кальций': '🦴', 'Калий': '⚡', 'Магний': '🧲',
  'Цинк': '🔬', 'Селен': '🌰', 'Фосфор': '🧪', 'Натрий': '🧂', 'Омега-3': '🐟'
};

const OVERDOSE_INFO: Record<string, string> = {
  'Витамин A': 'Разовая передозировка может вызвать тошноту и головную боль. Систематический избыток токсичен для печени.',
  'Витамин D': 'Кратковременный избыток обычно безопасен. Хроническая передозировка ведет к слабости, кальцификации сосудов и камням в почках.',
  'Витамин E': 'Разово: легкое расстройство желудка. Систематически: риск кровотечений и снижение усвоения других витаминов.',
  'Витамин C': 'Разово: возможна изжога или диарея. Излишки водорастворимого витамина выводятся. Систематически: риск образования камней в почках.',
  'Витамин B6': 'Разово безопасно в небольших дозах. Систематический сильный избыток может привести к онемению (нейропатии).',
  'Фолиевая кислота': 'Безопасно разово. Долгий избыток может маскировать дефицит витамина B12, что опасно для нервной системы.',
  'Железо': 'Разово: тошнота, дискомфорт в желудке. Систематически: накапливается в органах, вызывая поражение печени и сердца.',
  'Кальций': 'Разово: возможны запоры. Систематически: риск камней в почках и отложения кальция на стенках сосудов.',
  'Магний': 'Разово: послабляющий эффект (диарея), снижение давления. Организм обычно справляется с разовым избытком.',
  'Цинк': 'Разово: появление легкой тошноты. Систематически: подавляет иммунитет и приводит к дефициту меди.',
  'Селен': 'Разово безопасно. Хронический избыток ведет к ломкости ногтей, выпадению волос и чесночному запаху кожи.',
  'Натрий': 'Разово: задержка жидкости, легкие отеки. Систематически: развитие гипертонии и перегрузка сердца.',
  'Калий': 'У здоровых людей излишки выводятся. Систематический избыток опасен нарушением ритма сердца (аритмией).',
  'Фосфор': 'Разово безопасно. Хроническая передозировка ускоренно вымывает кальций из костей.',
  'Омега-3': 'Разово: легкое расстройство желудка. Систематический сильный избыток (в добавках) снижает свертываемость крови.',
  'Йод': 'Разово безопасно. Хронический излишек может спровоцировать гипертиреоз (ускоренную работу щитовидной железы).'
};

const isVitamin = (name: string) => name.startsWith('Витамин') || name === 'Фолиевая кислота';
const calcPercentSafe = (val: number, max: number) => Math.max(0, (val / Math.max(max, 1)) * 100);

// ── Zone colors ─────────────────────────

const ZONE_COLORS = {
  green:  { bg: "#ECFDF5", text: "#059669", stroke: "#10B981" },
  yellow: { bg: "#FFFBEB", text: "#D97706", stroke: "#F59E0B" },
  red:    { bg: "#FEF2F2", text: "#DC2626", stroke: "#EF4444" },
  blue:   { bg: "#EFF6FF", text: "#2563EB", stroke: "#3B82F6" },
};

// ── Props ──────────────────────────────────────────

interface GlycemicSurfPanelProps {
  startIso: string;
  endIso: string;
  dynamicMicros?: Record<string, number>;
  consumedMicros?: Record<string, number>;
}

// ── Component ──────────────────────────────────────

export default function GlycemicSurfPanel({
  startIso,
  endIso,
  dynamicMicros = {},
  consumedMicros = {},
}: GlycemicSurfPanelProps) {
  const [timelineData, setTimelineData] = useState<GlycemicTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMicrosExpanded, setIsMicrosExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.getGlycemicTimeline(startIso, endIso);
        if (!cancelled) setTimelineData(data);
      } catch (err) {
        console.error("[GlycemicSurfPanel] Failed to load timeline:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [startIso, endIso]);

  // Normalize consumed micros
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
  const trackedMicros = microsEntries.filter(([name]) => dynamicMicros[name] && dynamicMicros[name] > 0);
  const avgCoverage = trackedMicros.length > 0
    ? Math.round(trackedMicros.reduce((acc, [name, { value }]) => acc + calcPercentSafe(value, dynamicMicros[name]!), 0) / trackedMicros.length)
    : 0;

  const stats = timelineData?.stats;
  const hasData = timelineData && timelineData.timeline.length > 0 && timelineData.meals.length > 0;

  const thresholds = timelineData?.zoneThresholds ?? { greenMax: 110, yellowMax: 140 };

  // Determine spike zone color for max stat
  const getSpikeZone = (mg: number) => {
    if (mg <= thresholds.greenMax) return ZONE_COLORS.green;
    if (mg <= thresholds.yellowMax) return ZONE_COLORS.yellow;
    return ZONE_COLORS.red;
  };

  return (
    <div className="bg-surface-muted border-b border-border pb-1 px-1 pt-1">
      {/* ── Main Glycemic Panel ────────────────────────── */}
      <div className="bg-white rounded-[16px] shadow-sm border border-border mx-0 mt-0 mb-1">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏄</span>
            <div>
              <div className="mb-0.5">
                <h4 className="text-sm font-bold text-ink leading-tight">
                  <span className="align-middle">Инсулиновый сёрфинг</span>
                  <button onClick={() => setShowInfo(true)} className="inline-flex align-middle ml-1.5 p-0.5 rounded-full text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors shadow-sm">
                    <Info className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </h4>
              </div>
              <p className="text-[10px] text-ink-faint">Гликемический отклик за день</p>
            </div>
          </div>
          {stats && (
            <div className="text-right">
              <span className="text-[11px] text-ink-muted">Avg</span>
              <span className="ml-1 text-sm font-bold text-ink">{stats.average_glucose_mg_dl}</span>
              <span className="text-[10px] text-ink-faint ml-0.5">мг/дл</span>
            </div>
          )}
        </div>

        {/* ZoneStatsBar */}
        {stats && (
          <div className="mx-3 mb-1">
            <div className="flex h-7 rounded-full overflow-hidden border border-border/50 shadow-inner">
              {([
                { key: "green" as const, hours: stats.hours_in_green, emoji: "🟢" },
                { key: "yellow" as const, hours: stats.hours_in_yellow, emoji: "🟡" },
                { key: "red" as const, hours: stats.hours_in_red, emoji: "🔴" },
                { key: "blue" as const, hours: stats.hours_in_blue, emoji: "🔵" },
              ]).filter(z => z.hours > 0).map((zone) => {
                const totalHours = stats.hours_in_green + stats.hours_in_yellow + stats.hours_in_red + stats.hours_in_blue;
                const pct = totalHours > 0 ? (zone.hours / totalHours) * 100 : 0;
                const colors = ZONE_COLORS[zone.key];
                return (
                  <div
                    key={zone.key}
                    className="flex items-center justify-center gap-1 text-[11px] font-bold transition-all duration-500 min-w-[56px] px-1 whitespace-nowrap"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    <span>{zone.emoji}</span>
                    <span>{zone.hours}ч</span>
                  </div>
                );
              })}
            </div>
            
            {/* Tab on Top of Graph */}
            <div className="flex justify-end mr-6 mt-1 -mb-[3px] relative z-20 pointer-events-none">
              <button 
                onClick={() => setShowThresholds((p) => !p)}
                onBlur={() => setShowThresholds(false)}
                className="relative flex items-center cursor-pointer pointer-events-auto bg-white/95 backdrop-blur-md rounded-t-[10px] px-2 py-[3px] border-x border-t border-border/50 shadow-[0_-2px_4px_-3px_rgba(0,0,0,0.1)] outline-none"
              >
                <Info className="w-[10px] h-[10px] text-ink-muted opacity-80" />
                <span className="text-[9px] text-ink-muted ml-1 font-semibold uppercase tracking-wider">Границы</span>
                
                {showThresholds && (
                  <div 
                    className="absolute top-full right-0 mt-[1px] w-56 p-2.5 bg-gray-900 text-white text-[11px] leading-normal rounded-xl shadow-xl z-50 text-left border border-gray-700/50 cursor-default shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking inside the tooltip
                  >
                    <div className="font-bold mb-1.5">Ваши персональные границы:</div>
                    <div className="flex gap-1.5"><span className="text-emerald-400">🟢</span> Оптимально: &lt; {thresholds.greenMax} мг/дл</div>
                    <div className="flex gap-1.5"><span className="text-amber-400">🟡</span> Повышено: до {thresholds.yellowMax} мг/дл</div>
                    {thresholds.greenMax < 110 && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-700/60 font-medium text-blue-300">
                        Границы усилены вашей целью!
                      </div>
                    )}
                  </div>
                )}
              </button>
            </div>
          </div>
        )}

        {/* SVG Chart or Loading/Empty State */}
        <div className="px-1 pb-1">
          {isLoading ? (
            /* Skeleton shimmer */
            <div className="h-[130px] rounded-2xl bg-gradient-to-r from-surface-muted via-surface-subtle to-surface-muted animate-pulse" />
          ) : !hasData ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <span className="text-4xl mb-3">🏄</span>
              <p className="text-sm font-bold text-ink mb-1">Тут пока пусто!</p>
              <p className="text-xs text-ink-muted max-w-[260px]">
                Запиши первый приём пищи, чтобы увидеть свою гликемическую волну.
              </p>
            </div>
          ) : (
            <GlycemicCurveChart
              timeline={timelineData!.timeline}
              meals={timelineData!.meals}
              baseline={timelineData!.baseline_mg_dl}
              zoneThresholds={thresholds}
            />
          )}
        </div>

        {/* Quick Stats Cards */}
        {stats && hasData && (
          <div className="flex gap-2.5 px-4 pb-4">
            {/* Max Spike */}
            <div
              className="flex-1 rounded-[14px] p-2.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md cursor-default flex flex-col items-center"
              style={{ backgroundColor: getSpikeZone(stats.max_spike_mg_dl).bg }}
            >
              <TrendingUp className="w-5 h-5 mb-0.5 opacity-80" strokeWidth={2.5} color={getSpikeZone(stats.max_spike_mg_dl).text} />
              <span
                className="text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: getSpikeZone(stats.max_spike_mg_dl).text }}
              >
                MAX ПИК
              </span>
              <span className="text-[18px] font-[800] text-ink leading-none mt-1">
                {Math.round(stats.max_spike_mg_dl)}
              </span>
              <span className="text-[9px] text-ink-muted">мг/дл</span>
            </div>

            {/* Hours in Green */}
            <div
              className="flex-1 rounded-[14px] p-2.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md cursor-default flex flex-col items-center"
              style={{ backgroundColor: ZONE_COLORS.green.bg }}
            >
              <Timer className="w-5 h-5 mb-0.5 opacity-80" strokeWidth={2.5} color={ZONE_COLORS.green.text} />
              <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: ZONE_COLORS.green.text }}>
                В ЗЕЛЁНОМ
              </span>
              <span className="text-[18px] font-[800] text-ink leading-none mt-1">
                {stats.hours_in_green}
              </span>
              <span className="text-[9px] text-ink-muted">часов</span>
            </div>

            {/* Average Glucose */}
            <div
              className="flex-1 rounded-[14px] p-2.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-md cursor-default flex flex-col items-center"
              style={{ backgroundColor: getSpikeZone(stats.average_glucose_mg_dl).bg }}
            >
              <Target className="w-5 h-5 mb-0.5 opacity-80" strokeWidth={2.5} color={getSpikeZone(stats.average_glucose_mg_dl).text} />
              <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: getSpikeZone(stats.average_glucose_mg_dl).text }}>
                СРЕДНЕЕ
              </span>
              <span className="text-[18px] font-[800] text-ink leading-none mt-1">
                {stats.average_glucose_mg_dl}
              </span>
              <span className="text-[9px] text-ink-muted">мг/дл</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile Supplements Block ────────────────────────────────── */}
      <div className="sm:hidden w-full px-1 mb-3.5">
        <div className="bg-white rounded-[20px] shadow-sm border border-border p-3.5">
          <SupplementChecklistWidget variant="mobileStrip" startIso={startIso} endIso={endIso} />
        </div>
      </div>

      {/* ── Desktop Supplements (floating in header region) ────────── */}
      <div className="hidden sm:block px-1 mb-3.5">
        <div className="bg-white rounded-[20px] shadow-sm border border-border p-3.5">
          <SupplementChecklistWidget variant="compact" startIso={startIso} endIso={endIso} />
        </div>
      </div>

      {/* ── Micronutrients Expansion Panel (reused from DailyAllowancesPanel) ──── */}
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
              {/* Overall Score Ring */}
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
                      {list.map(([name, { value, unit }]) => {
                        const target = dynamicMicros[name];
                        const safeTarget = target || Math.max(value, 100);
                        const pct = calcPercentSafe(value, safeTarget);
                        const level = getMicroLevel(pct);
                        return (
                          <div key={name} className="flex items-center justify-between gap-3 py-1.5 px-0.5">
                            {/* Icon */}
                            <div className={`w-9 h-9 shrink-0 rounded-[12px] flex items-center justify-center text-[18px] shadow-sm bg-white border border-border/50 ${isVitamin(name) ? 'bg-[#FFFBF2]' : 'bg-[#F8FAFC]'}`}>
                              {NUTRIENT_EMOJI[name] || '💊'}
                            </div>

                            {/* Middle Info */}
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
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>

                            {/* Badge */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              {level.isOverdose && (
                                <div
                                  className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[12px] font-bold shadow-sm animate-pulse cursor-help"
                                  title={OVERDOSE_INFO[name] || 'Превышение нормы может быть токсичным для организма'}
                                >
                                  !
                                </div>
                              )}
                              <div className={`min-w-[42px] text-center px-1.5 py-1 rounded-md text-[11px] font-[800] ${level.badgeBg} ${level.badgeText}`}>
                                {Math.round(pct)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Footer Legend */}
              <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex gap-1">
                  {['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'].map(c => (
                    <div key={c} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-primary-600">
                  ✧ Гликемический сёрфинг
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* ── Glycemic Surfing Info Modal ──────────────────────────── */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent onClose={() => setShowInfo(false)} className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-ink">
              <Activity className="w-5 h-5 text-blue-500" />
              Что такое Инсулиновый Сёрфинг?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-ink leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
            <p>
              <strong>Инсулиновый сёрфинг</strong> — это метафоричное название для контроля уровней глюкозы и инсулина в крови. Наша цель — гладко скользить по плавным «волнам», избегая опасных сахарных цунами и резких провалов, вызванных высокоуглеводной едой.
            </p>

            <div>
              <h5 className="font-bold mb-1">Почему это крайне важно?</h5>
              <p>Резкие скачки сахара разрушают сосуды изнутри, вызывают системное воспаление, ускоряют старение и в итоге ведут к инсулинорезистентности. Плавные, управляемые волны сохраняют стабильный уровень энергии, защищают мозг от «тумана» и дают вам контроль над эмоциональным перееданием.</p>
            </div>

            <div>
              <h5 className="font-bold mb-1">Почему мы отказались от подсчета калорий (КБЖУ)?</h5>
              <p>Калория — это единица тепла, а не физиологии. 500 ккал из торта и 500 ккал из стейка с зеленью вызывают абсолютно разные гормональные реакции. Слепой подсчет граммов белков, жиров и углеводов (БЖУ) не отвечает на главный вопрос: пустит ли ваше тело эту еду на энергию, или из-за скачка инсулина немедленно запрет её в жировых депо. Фокусируясь на гликемическом отклике, мы работаем с реальным метаболизмом, а не сухой математикой. Это единственный способ устойчиво регулировать вес и нормализовать гормональный баланс, естественным путем возвращая вам стабильную энергию, чувство сытости и ясность ума.</p>
            </div>

            <div>
              <h5 className="font-bold mb-2">Как читать график?</h5>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <span className="shrink-0 mt-0.5 text-[#059669]">🟢</span>
                  <span><strong>Зелёная зона (до 110 мг/дл):</strong> Зона спокойной воды и идеального серфинга. Вы стройнеете, чувствуете долгую энергию и ясность ума.</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 mt-0.5 text-[#D97706]">🟡</span>
                  <span><strong>Жёлтая зона (до 140 мг/дл):</strong> Предупреждение. Волна набирает опасную высоту. Печень напряглась, выброшен инсулин.</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 mt-0.5 text-[#DC2626]">🔴</span>
                  <span><strong>Красная зона (выше 140):</strong> Сахарное цунами. Сосуды повреждаются, организм экстренно останавливает сжигание жира и начинает запасать углеводы в бока. Скоро вас накроет усталость.</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#EFF6FF] p-3.5 rounded-[14px] border border-[#BFDBFE]/50 relative overflow-hidden mt-2">
              <div className="absolute -right-4 -bottom-4 opacity-10 text-6xl">🏄</div>
              <h5 className="font-bold mb-1 text-[#2563EB] relative z-10">Что это дает вам?</h5>
              <p className="text-[13px] text-[#1D4ED8] relative z-10">
                Соблюдая правила «сёрфинга» и удерживаясь в зелёных зонах, вы избавляетесь от вечернего жора, спонтанной усталости после обеда и получаете ровную, предсказуемую энергию 24/7. Ваше тело из режима паники переходит в естественный режим жиросжигания.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
