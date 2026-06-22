import React from 'react';

export interface DashboardCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  subtitleIcon?: React.ReactNode;
  badge?: string;
  accentColor: 'teal' | 'indigo' | 'rose' | 'purple';
  height?: 'tall' | 'short';
  alertIndicator?: boolean;
  backgroundIcon?: React.ReactNode;
  onClick?: () => void;
}

const colorMap = {
  teal: {
    gradient: 'from-teal-500/15',
    iconBg: 'bg-teal-500/20',
    iconText: 'text-teal-400',
    iconBorder: 'border-teal-500/20',
    iconShadow: 'shadow-teal-500/10',
    badgeText: 'text-teal-200',
    subtitleText: 'text-teal-300/70',
    bgIconText: 'text-teal-500/10',
  },
  indigo: {
    gradient: 'from-indigo-500/15',
    iconBg: 'bg-indigo-500/20',
    iconText: 'text-indigo-400',
    iconBorder: 'border-indigo-500/20',
    iconShadow: 'shadow-indigo-500/10',
    badgeText: 'text-indigo-200',
    subtitleText: 'text-indigo-300/70',
    bgIconText: 'text-indigo-500/10',
  },
  rose: {
    gradient: 'from-rose-500/15',
    iconBg: 'bg-rose-500/20',
    iconText: 'text-rose-400',
    iconBorder: 'border-rose-500/20',
    iconShadow: 'shadow-rose-500/10',
    badgeText: 'text-rose-200',
    subtitleText: 'text-rose-300/70',
    bgIconText: 'text-rose-500/10',
  },
  purple: {
    gradient: 'from-purple-500/15',
    iconBg: 'bg-purple-500/20',
    iconText: 'text-purple-400',
    iconBorder: 'border-purple-500/20',
    iconShadow: 'shadow-purple-500/10',
    badgeText: 'text-purple-200',
    subtitleText: 'text-purple-300/70',
    bgIconText: 'text-purple-500/10',
  }
};

/**
 * Reusable Glassmorphism Card Component for the Mobile Dashboard.
 * 
 * Used for central actions in the 2x2 grid (e.g. "Подача анализов", "Отчеты").
 */
export function DashboardCard({
  icon,
  title,
  subtitle,
  subtitleIcon,
  badge,
  accentColor,
  height = 'tall',
  alertIndicator,
  backgroundIcon,
  onClick
}: DashboardCardProps) {
  const colors = colorMap[accentColor];
  const heightClass = height === 'tall' ? 'h-[230px]' : 'h-[180px]';
  const Container = onClick ? 'button' : 'div';

  return (
    <Container
      onClick={onClick}
      className={`card-glass rounded-[32px] ${heightClass} flex flex-col justify-between relative overflow-hidden group w-full text-left transition-all`}
    >
      {/* Gradient Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} to-transparent opacity-80 pointer-events-none`} />

      {/* Background Decorative Icon */}
      {backgroundIcon && (
        <div className={`absolute -right-6 -bottom-6 ${colors.bgIconText} -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 pointer-events-none`}>
          {backgroundIcon}
        </div>
      )}

      {/* Header Section (Top) */}
      <div className="flex justify-between items-start relative z-10 p-4 pb-0 w-full">
        <div className={`w-12 h-12 rounded-[20px] ${colors.iconBg} ${colors.iconText} border ${colors.iconBorder} shadow-lg ${colors.iconShadow} flex items-center justify-center`}>
          {icon}
        </div>

        {alertIndicator ? (
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-alert-glow mt-1 mr-1" />
        ) : badge ? (
          <div className="px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white border border-white/5 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            {badge}
          </div>
        ) : null}
      </div>

      {/* Footer Section (Bottom) */}
      <div className="relative z-10 p-4 pt-0 w-full">
        <h3 className="text-white font-semibold text-base leading-snug">
          {title}
        </h3>
        <div className={`${colors.subtitleText} text-xs mt-2 font-medium flex items-center gap-1.5`}>
          {subtitleIcon && <span>{subtitleIcon}</span>}
          {subtitle}
        </div>
      </div>
    </Container>
  );
}
