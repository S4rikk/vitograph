"use client";

import { useState, useRef, useEffect } from "react";
import { TrendingUp, Timer, Target, Activity, Info, Lightbulb, ChevronRight } from "lucide-react";
import SupplementChecklistWidget from "@/components/shared/SupplementChecklistWidget";
import GlycemicCurveChart from "./GlycemicCurveChart";
import { apiClient } from "@/lib/api-client";
import type { GlycemicTimelineData } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTranslations } from "next-intl";
import { MICRONUTRIENT_NAME_MAPPING, normalizeMicronutrientKey, translateUnit } from "@/lib/food-diary/nutrient-utils";

// ── Reused Micronutrient Logic (from DailyAllowancesPanel) ──────────



const getMicroLevel = (pct: number) => {
  if (pct < 25) return { color: 'bg-gradient-to-r from-[#FCA5A5] to-[#EF4444]', badgeBg: 'bg-[#FEE2E2]', badgeText: 'text-[#DC2626]', label: '< 25%', isOverdose: false };
  if (pct < 50) return { color: 'bg-gradient-to-r from-[#FCD34D] to-[#F59E0B]', badgeBg: 'bg-[#FEF3C7]', badgeText: 'text-[#B45309]', label: 'Low', isOverdose: false };
  if (pct < 75) return { color: 'bg-gradient-to-r from-[#93C5FD] to-[#3B82F6]', badgeBg: 'bg-[#DBEAFE]', badgeText: 'text-[#1D4ED8]', label: 'Mid', isOverdose: false };
  if (pct < 100) return { color: 'bg-gradient-to-r from-[#6EE7B7] to-[#10B981]', badgeBg: 'bg-[#D1FAE5]', badgeText: 'text-[#047857]', label: 'Good', isOverdose: false };
  return { color: 'bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]', badgeBg: 'bg-[#EDE9FE] animate-pulse-border ring-1 ring-red-500/50', badgeText: 'text-[#6D28D9]', label: 'Over', isOverdose: true };
};

const NUTRIENT_EMOJI: Record<string, string> = {
  'Vitamin C': '🍊', 'Vitamin D': '☀️', 'Vitamin B6': '🥬', 'Vitamin A': '🫐',
  'Vitamin B12': '💊', 'Vitamin E': '🌻', 'Folic Acid': '🥦',
  'Iron': '🔩', 'Calcium': '🦴', 'Potassium': '⚡', 'Magnesium': '🧲',
  'Zinc': '🔬', 'Selenium': '🌰', 'Phosphorus': '🧪', 'Sodium': '🧂', 'Omega-3': '🐟'
};

const OVERDOSE_KEYS: Record<string, string> = {
  'Vitamin A': 'overdoseVitaminA', 'Vitamin D': 'overdoseVitaminD',
  'Vitamin E': 'overdoseVitaminE', 'Vitamin C': 'overdoseVitaminC',
  'Vitamin B6': 'overdoseVitaminB6', 'Folic Acid': 'overdoseFolicAcid',
  'Iron': 'overdoseIron', 'Calcium': 'overdoseCalcium',
  'Magnesium': 'overdoseMagnesium', 'Zinc': 'overdoseZinc',
  'Selenium': 'overdoseSelenium', 'Sodium': 'overdoseSodium',
  'Potassium': 'overdosePotassium', 'Phosphorus': 'overdosePhosphorus',
  'Omega-3': 'overdoseOmega3', 'Iodine': 'overdoseIodine',
};

const isVitamin = (name: string) => name.startsWith('Vitamin') || name === 'Folic Acid';
const calcPercentSafe = (val: number, max: number) => Math.max(0, (val / Math.max(max, 1)) * 100);

// ── Zone colors ─────────────────────────

const ZONE_COLORS = {
  green:  { bg: "#ECFDF5", text: "#059669", stroke: "#10B981", bgClass: "bg-emerald-50 dark:bg-emerald-500/15", textClass: "text-emerald-600 dark:text-emerald-400", borderClass: "border-emerald-200 dark:border-emerald-500/20" },
  yellow: { bg: "#FFFBEB", text: "#D97706", stroke: "#F59E0B", bgClass: "bg-amber-50 dark:bg-amber-500/15", textClass: "text-amber-600 dark:text-amber-400", borderClass: "border-amber-200 dark:border-amber-500/20" },
  red:    { bg: "#FEF2F2", text: "#DC2626", stroke: "#EF4444", bgClass: "bg-red-50 dark:bg-red-500/15", textClass: "text-red-600 dark:text-red-400", borderClass: "border-red-200 dark:border-red-500/20" },
  blue:   { bg: "#EFF6FF", text: "#2563EB", stroke: "#3B82F6", bgClass: "bg-blue-50 dark:bg-blue-500/15", textClass: "text-blue-600 dark:text-blue-400", borderClass: "border-blue-200 dark:border-blue-500/20" },
};

// ── Props ──────────────────────────────────────────

interface GlycemicSurfPanelProps {
  startIso: string;
  endIso: string;
  dynamicMicros?: Record<string, number>;
  consumedMicros?: Record<string, number>;
  refreshTrigger?: number;
}

// ── Component ──────────────────────────────────────

export default function GlycemicSurfPanel({
  startIso,
  endIso,
  dynamicMicros = {},
  consumedMicros = {},
  refreshTrigger = 0,
}: GlycemicSurfPanelProps) {
  const t = useTranslations("diary.glycemicSurf");
  const tNutrients = useTranslations("nutrients");
  const tUnits = useTranslations("units");
  const [timelineData, setTimelineData] = useState<GlycemicTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMicrosExpanded, setIsMicrosExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showThresholds, setShowThresholds] = useState(false);
  const [showCaloriesInfo, setShowCaloriesInfo] = useState(false);
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
  }, [startIso, endIso, refreshTrigger]);

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
  // Normalize dynamicMicros keys to match English canonical keys
  const normalizedDynamic: Record<string, number> = {};
  Object.entries(dynamicMicros).forEach(([rawKey, val]) => {
    const nk = normalizeMicronutrientKey(rawKey);
    normalizedDynamic[nk] = (normalizedDynamic[nk] || 0) + val;
  });
  const trackedMicros = microsEntries.filter(([name]) => normalizedDynamic[name] && normalizedDynamic[name] > 0);
  const avgCoverage = trackedMicros.length > 0
    ? Math.round(trackedMicros.reduce((acc, [name, { value }]) => acc + calcPercentSafe(value, normalizedDynamic[name]!), 0) / trackedMicros.length)
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
      <div className="bg-surface rounded-[16px] shadow-sm border border-border mx-0 mt-0 mb-1">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏄</span>
            <div>
              <div className="mb-0.5">
                <h4 className="text-sm font-bold text-ink leading-tight">
                  <span className="align-middle">{t("insulinSurfingTitle")}</span>
                  <button onClick={() => setShowInfo(true)} className="inline-flex align-middle ml-1.5 p-0.5 rounded-full text-blue-500 bg-blue-50 hover:bg-blue-100 transition-colors shadow-sm">
                    <Info className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </h4>
              </div>
              <p className="text-[0.625rem] text-ink-faint">{t("insulinSurfingSubtitle")}</p>
            </div>
          </div>
          {stats && (
            <div className="text-right">
              <span className="text-[0.6875rem] text-ink-muted">Avg</span>
              <span className="ml-1 text-sm font-bold text-ink">{stats.average_glucose_mg_dl}</span>
              <span className="text-[0.625rem] text-ink-faint ml-0.5">{t("mgDl")}</span>
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
                      className={`flex items-center justify-center gap-1 text-[0.6875rem] font-bold transition-all duration-500 min-w-[56px] px-1 whitespace-nowrap ${colors.bgClass} ${colors.textClass}`}
                      style={{
                        width: `${pct}%`,
                      }}
                    >
                      <span>{zone.emoji}</span>
                      <span>{zone.hours}{t("hoursShort")}</span>
                    </div>
                );
              })}
            </div>
            
            {/* Tab on Top of Graph */}
            <div className="flex justify-end mr-6 mt-1 -mb-[3px] relative z-20 pointer-events-none">
              <button 
                onClick={() => setShowThresholds((p) => !p)}
                onBlur={() => setShowThresholds(false)}
                className="relative flex items-center cursor-pointer pointer-events-auto bg-surface/95 backdrop-blur-md rounded-t-[10px] px-2 py-[3px] border-x border-t border-border/50 shadow-[0_-2px_4px_-3px_rgba(0,0,0,0.1)] outline-none"
              >
                <Info className="w-[10px] h-[10px] text-ink-muted opacity-80" />
                <span className="text-[0.5625rem] text-ink-muted ml-1 font-semibold uppercase tracking-wider">{t("thresholds")}</span>
                
                {showThresholds && (
                  <div 
                    className="absolute top-full right-0 mt-[1px] w-56 p-2.5 bg-gray-900 text-white text-[0.6875rem] leading-normal rounded-xl shadow-xl z-50 text-left border border-gray-700/50 cursor-default shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking inside the tooltip
                  >
                    <div className="font-bold mb-1.5">{t("personalThresholds")}</div>
                    <div className="flex gap-1.5"><span className="text-emerald-400">🟢</span> {t("optimalThreshold")} {thresholds.greenMax} {t("mgDl")}</div>
                    <div className="flex gap-1.5"><span className="text-amber-400">🟡</span> {t("elevatedThreshold")} {thresholds.yellowMax} {t("mgDl")}</div>
                    {thresholds.greenMax < 110 && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-700/60 font-medium text-blue-300">
                        {t("thresholdsEnhanced")}
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
              <p className="text-sm font-bold text-ink mb-1">{t("emptyChartTitle")}</p>
              <p className="text-xs text-ink-muted max-w-[260px]">
                {t("emptyChartDesc")}
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
          <div className="flex gap-2 px-3 pb-3">
            {/* Max Spike */}
            <div className={`flex-1 rounded-[10px] p-1.5 flex flex-col items-center justify-center border ${getSpikeZone(stats.max_spike_mg_dl).bgClass} ${getSpikeZone(stats.max_spike_mg_dl).borderClass}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <TrendingUp className={`w-3 h-3 opacity-80 ${getSpikeZone(stats.max_spike_mg_dl).textClass}`} strokeWidth={2.5} />
                <span className={`text-[0.5rem] font-semibold uppercase tracking-wide ${getSpikeZone(stats.max_spike_mg_dl).textClass}`}>
                  {t("maxSpike")}
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[0.875rem] font-[800] text-ink leading-none">
                  {Math.round(stats.max_spike_mg_dl)}
                </span>
                <span className="text-[0.5rem] text-ink-muted leading-none">{t("mgDl")}</span>
              </div>
            </div>

            {/* Hours in Green */}
            <div className={`flex-1 rounded-[10px] p-1.5 flex flex-col items-center justify-center border ${ZONE_COLORS.green.bgClass} ${ZONE_COLORS.green.borderClass}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <Timer className={`w-3 h-3 opacity-80 ${ZONE_COLORS.green.textClass}`} strokeWidth={2.5} />
                <span className={`text-[0.5rem] font-semibold uppercase tracking-wide ${ZONE_COLORS.green.textClass}`}>
                  {t("inGreenZone")}
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[0.875rem] font-[800] text-ink leading-none">
                  {stats.hours_in_green}
                </span>
                <span className="text-[0.5rem] text-ink-muted leading-none">{t("hours")}</span>
              </div>
            </div>

            {/* Average Glucose */}
            <div className={`flex-1 rounded-[10px] p-1.5 flex flex-col items-center justify-center border ${getSpikeZone(stats.average_glucose_mg_dl).bgClass} ${getSpikeZone(stats.average_glucose_mg_dl).borderClass}`}>
              <div className="flex items-center gap-1 mb-0.5">
                <Target className={`w-3 h-3 opacity-80 ${getSpikeZone(stats.average_glucose_mg_dl).textClass}`} strokeWidth={2.5} />
                <span className={`text-[0.5rem] font-semibold uppercase tracking-wide ${getSpikeZone(stats.average_glucose_mg_dl).textClass}`}>
                  {t("averageValue")}
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[0.875rem] font-[800] text-ink leading-none">
                  {stats.average_glucose_mg_dl}
                </span>
                <span className="text-[0.5rem] text-ink-muted leading-none">{t("mgDl")}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Supplements Blocks ────────────────────────────────── */}
      <SupplementChecklistWidget variant="mobileStrip" startIso={startIso} endIso={endIso} />
      <SupplementChecklistWidget variant="compact" startIso={startIso} endIso={endIso} />

      {/* ── Micronutrients Expansion Panel (reused from DailyAllowancesPanel) ──── */}
      <div className="bg-surface rounded-[20px] shadow-sm border border-border mt-3.5 mx-1 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setIsMicrosExpanded(!isMicrosExpanded)}
          className="flex w-full items-center justify-between p-4 focus:outline-none hover:bg-surface-muted transition-colors text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✨</span>
            <div>
              <h4 className="text-[0.8125rem] font-bold text-ink leading-tight">{t("micronutrientsTitle")}</h4>
              <p className="text-[0.625rem] text-ink-faint">{trackedMicros.length} {t("outOf16Tracked")}</p>
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
                  <span className="absolute text-[0.8125rem] font-bold">{avgCoverage}%</span>
                </div>
                <div>
                  <p className="text-[0.75rem] font-bold text-ink">{t("dailyNormCoverage")}</p>
                  <p className="text-[0.625rem] text-ink-faint">{t("averageValueDesc")}</p>
                </div>
              </div>

              {/* Render 2 categories: ВИТАМИНЫ / МИНЕРАЛЫ */}
              {(['vitamins', 'minerals'] as const).map(catKey => {
                const catLabel = catKey === 'vitamins' ? t("vitamins") : t("minerals");
                const list = microsEntries.filter(([name]) => (catKey === 'vitamins' ? isVitamin(name) : !isVitamin(name)));
                if (list.length === 0) return null;

                return (
                  <div key={catKey} className="mb-6 last:mb-0">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${catKey === 'vitamins' ? 'bg-[#F59E0B]' : 'bg-[#6366F1]'}`} />
                      <h5 className="text-[0.625rem] font-bold uppercase tracking-wider text-ink-muted">{catLabel}</h5>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      {list.map(([name, { value, unit }]) => {
                        const target = normalizedDynamic[name];
                        const safeTarget = target || Math.max(value, 100);
                        const pct = calcPercentSafe(value, safeTarget);
                        const level = getMicroLevel(pct);
                        return (
                          <div key={name} className="flex items-center justify-between gap-3 py-1.5 px-0.5">
                            {/* Icon */}
                            <div className={`aspect-square p-2 shrink-0 rounded-[0.75rem] flex items-center justify-center text-[1.25rem] leading-normal shadow-sm bg-surface border border-border/50 ${isVitamin(name) ? 'bg-[#FFFBF2]' : 'bg-[#F8FAFC]'}`}>
                              {NUTRIENT_EMOJI[name] || '💊'}
                            </div>

                            {/* Middle Info */}
                            <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                              <div className="flex items-end justify-between leading-none mb-1.5 mt-0.5">
                                <span className="text-[0.875rem] font-[700] text-ink truncate mr-2">{tNutrients.has(name) ? tNutrients(name) : name}</span>
                                <span className="text-[0.8125rem] font-bold text-ink shrink-0">
                                  {Number(value.toFixed(1))} <span className="text-ink-muted font-medium text-[0.75rem]">/ {target || '—'} {translateUnit(unit, tUnits)}</span>
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
                                  className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[0.75rem] font-bold shadow-sm animate-pulse cursor-help"
                                  title={OVERDOSE_KEYS[name] && tNutrients.has(OVERDOSE_KEYS[name]) ? tNutrients(OVERDOSE_KEYS[name]) : t('overdoseDefault')}
                                >
                                  !
                                </div>
                              )}
                              <div className={`min-w-[42px] text-center px-1.5 py-1 rounded-md text-[0.6875rem] font-[800] ${level.badgeBg} ${level.badgeText}`}>
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
                <span className="text-[0.625rem] font-bold text-primary-600">
                  ✧ {t("glycemicSurfingFooter")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── "Where are calories?" hint badge ─── */}
      <button
        onClick={() => setShowCaloriesInfo(true)}
        className="flex items-center gap-2 w-[calc(100%-8px)] mx-1 px-3 py-2 mt-2 mb-1 rounded-xl
          bg-surface-muted/50 dark:bg-surface-muted/30
          border border-border/30
          text-xs text-ink-muted font-medium
          hover:bg-surface-muted/80 dark:hover:bg-surface-muted/50
          transition-colors cursor-pointer group"
      >
        <Lightbulb className="w-3.5 h-3.5 text-amber-500/70 group-hover:text-amber-500 transition-colors shrink-0" />
        <span className="flex-1 text-left">{t("whereAreCalories")}</span>
        <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />
      </button>

      {/* ── Glycemic Surfing Info Modal ──────────────────────────── */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent onClose={() => setShowInfo(false)} className="sm:max-w-[600px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-ink">
              <Activity className="w-5 h-5 text-blue-500" />
              {t("infoModalTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-ink leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
            <p dangerouslySetInnerHTML={{ __html: t.raw("infoModalDesc1") }} />

            <div>
              <h5 className="font-bold mb-1">{t("infoModalWhyTitle")}</h5>
              <p>{t("infoModalWhyDesc")}</p>
            </div>

            <div>
              <h5 className="font-bold mb-1">{t("infoModalCaloriesTitle")}</h5>
              <p>{t("infoModalCaloriesDesc")}</p>
            </div>

            <div>
              <h5 className="font-bold mb-2">{t("infoModalHowToReadTitle")}</h5>
              <ul className="space-y-2">
                <li className="flex gap-2">
                  <span className="shrink-0 mt-0.5 text-[#059669]">🟢</span>
                  <span><strong>{t("infoModalGreenZone")}</strong> {t("infoModalGreenDesc")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 mt-0.5 text-[#D97706]">🟡</span>
                  <span><strong>{t("infoModalYellowZone")}</strong> {t("infoModalYellowDesc")}</span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 mt-0.5 text-[#DC2626]">🔴</span>
                  <span><strong>{t("infoModalRedZone")}</strong> {t("infoModalRedDesc")}</span>
                </li>
              </ul>
            </div>

            <div className="bg-[#EFF6FF] p-3.5 rounded-[14px] border border-[#BFDBFE]/50 relative overflow-hidden mt-2">
              <div className="absolute -right-4 -bottom-4 opacity-10 text-6xl">🏄</div>
              <h5 className="font-bold mb-1 text-[#2563EB] relative z-10">{t("infoModalBenefitTitle")}</h5>
              <p className="text-[0.8125rem] text-[#1D4ED8] relative z-10">
                {t("infoModalBenefitDesc")}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Calories Info Modal ── */}
      <Dialog open={showCaloriesInfo} onOpenChange={setShowCaloriesInfo}>
        <DialogContent onClose={() => setShowCaloriesInfo(false)} className="sm:max-w-[540px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-ink">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              {t("caloriesModalTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-ink leading-relaxed max-h-[70vh] overflow-y-auto pr-2">
            <p>{t("caloriesModalP1")}</p>
            <p>{t("caloriesModalP2")}</p>

            <div className="border-t border-border pt-4 mt-4">
              <h5 className="font-bold text-ink mb-2">{t("caloriesModalP3Title")}</h5>
              <p>{t("caloriesModalP3")}</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-500/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-500/20 mt-2">
              <p className="text-[0.8125rem] text-blue-800 dark:text-blue-300 font-medium">
                {t("caloriesModalDisclaimer")}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
