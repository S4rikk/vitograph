import { useTranslations } from "next-intl";

type Status = "optimal" | "low" | "high" | "critical_low" | "critical_high";

type ResultCardProps = {
  name: string;
  value: string;
  unit: string;
  status: Status;
  refMin?: number;
  refMax?: number;
};

const STATUS_CONFIG: Record<
  Status,
  { labelKey: string; color: string; bg: string; icon: string }
> = {
  optimal: {
    labelKey: "optimal",
    color: "text-success",
    bg: "bg-green-500/10",
    icon: "✓",
  },
  low: {
    labelKey: "low",
    color: "text-warning",
    bg: "bg-amber-500/10",
    icon: "↓",
  },
  high: {
    labelKey: "high",
    color: "text-warning",
    bg: "bg-amber-500/10",
    icon: "↑",
  },
  critical_low: {
    labelKey: "critical",
    color: "text-error",
    bg: "bg-red-500/10",
    icon: "↓↓",
  },
  critical_high: {
    labelKey: "critical",
    color: "text-error",
    bg: "bg-red-500/10",
    icon: "↑↑",
  },
};

/**
 * A single biomarker result card.
 *
 * Displays name, value, unit and a colored status badge.
 * Reference range is shown if available.
 */
export default function ResultCard({
  name,
  value,
  unit,
  status,
  refMin,
  refMax,
}: ResultCardProps) {
  const t = useTranslations("medical");
  const cfg = STATUS_CONFIG[status];

  return (
    <article
      className={`
        group relative overflow-hidden rounded-xl border border-border
        bg-surface p-5 shadow-sm transition-shadow duration-200
        hover:shadow-md
      `}
    >
      {/* Status indicator stripe */}
      <div
        className={`absolute left-0 top-0 h-full w-1 ${cfg.bg} ${cfg.color}`}
        style={{ backgroundColor: "currentColor", opacity: 0.6 }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-ink-muted truncate">
            {name}
          </h3>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink">
            {value}
            <span className="ml-1.5 text-sm font-normal text-ink-faint">
              {unit}
            </span>
          </p>
          {refMin !== undefined && refMax !== undefined && (
            <p className="mt-1 text-xs text-ink-faint">
              {t("refRange")}: {refMin}–{refMax} {unit}
            </p>
          )}
        </div>

        <span
          className={`
            flex-shrink-0 inline-flex items-center gap-1 rounded-full
            px-2.5 py-1 text-xs font-semibold
            ${cfg.bg} ${cfg.color}
          `}
        >
          <span aria-hidden="true">{cfg.icon}</span>
          {t(`statuses.${cfg.labelKey}`)}
        </span>
      </div>
    </article>
  );
}
