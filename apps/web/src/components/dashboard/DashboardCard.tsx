import React from 'react';

export interface DashboardCardProps {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  subtitleIcon?: React.ReactNode;
  badge?: string;
  accentColor: 'teal' | 'indigo' | 'rose' | 'purple';
  height?: 'tall' | 'short';
  alertIndicator?: 'normal' | 'fatigue' | 'bad' | 'inactive' | boolean | null;
  backgroundIcon?: React.ReactNode;
  onClick?: () => void;
  bgOpacity?: number;
  blurAmount?: number;
  gradientOpacity?: number;
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
  onClick,
  bgOpacity = 0.4,
  blurAmount = 24,
  gradientOpacity = 0.8
}: DashboardCardProps) {
  const colors = colorMap[accentColor];
  const flexStyle = height === 'tall'
    ? { flex: '1.28 1 0%', minHeight: 0 }
    : { flex: '1 1 0%', minHeight: 0 };
  
  const cardStyle = {
    ...flexStyle,
    background: `rgba(30, 41, 59, ${bgOpacity})`,
    backdropFilter: `blur(${blurAmount}px)`,
    WebkitBackdropFilter: `blur(${blurAmount}px)`
  };
  
  let alertClass = 'animate-alert-glow';
  let alertShadow = 'shadow-[0_0_8px_rgba(244,63,94,0.8)]';

  if (alertIndicator === 'bad') {
    alertClass = 'animate-alert-glow-bad';
    alertShadow = 'shadow-[0_0_12px_rgba(244,63,94,0.95)]';
  } else if (alertIndicator === 'fatigue') {
    alertClass = 'animate-alert-glow-fatigue';
    alertShadow = 'shadow-[0_0_10px_rgba(244,63,94,0.88)]';
  } else if (alertIndicator === 'inactive') {
    alertClass = 'opacity-40';
    alertShadow = '';
  }

  const Container = onClick ? 'button' : 'div';

  return (
    <Container
      onClick={onClick}
      style={cardStyle}
      className="card-glass rounded-[32px] flex flex-col justify-between relative overflow-hidden group w-full text-left transition-all min-h-0"
    >
      {/* Gradient Overlay */}
      <div 
        className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} to-transparent pointer-events-none`} 
        style={{ opacity: gradientOpacity }}
      />

      {/* Background Decorative Icon */}
      {backgroundIcon && (
        <div className={`absolute -right-6 -bottom-6 ${colors.bgIconText} -rotate-12 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-500 pointer-events-none`}>
          {backgroundIcon}
        </div>
      )}

      {/* Glass Cracks Overlay for bad and fatigue states */}
      {(alertIndicator === 'fatigue' || alertIndicator === 'bad') && (
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-0" 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
        >
          <defs>
            {/* Gradients to make cracks very bright at the impact center (85, 15) and fade out */}
            <radialGradient id="crack-grad" cx="85%" cy="15%" r="70%" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.75)" />
              <stop offset="20%" stopColor="rgba(255, 255, 255, 0.55)" />
              <stop offset="50%" stopColor="rgba(255, 255, 255, 0.32)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.1)" />
            </radialGradient>
            <radialGradient id="shadow-grad" cx="85%" cy="15%" r="70%" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(15, 23, 42, 0.85)" />
              <stop offset="25%" stopColor="rgba(15, 23, 42, 0.55)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0.12)" />
            </radialGradient>
          </defs>

          {/* Tapered Shadow */}
          <path d="M84.43,14.43 L77.85,21.52 L72.07,20.59 L71.93,21.41 L78.15,22.48 L85.57,15.57 Z M84.24,14.75 L81.51,23.84 L82.49,24.16 L85.76,15.25 Z M84.24,15.25 L87.51,24.16 L88.49,23.84 L85.76,14.75 Z M84.84,14.22 L74.99,16.50 L62.04,14.72 L61.96,15.28 L75.01,17.50 L85.16,15.78 Z M80.42,17.29 L82.81,21.57 L87.38,19.53 L88.50,17.50 L88.50,17.50 L86.62,18.47 L83.19,20.43 L81.58,16.71 Z M74.57,17.26 L77.66,22.37 L81.98,24.52 L87.35,22.45 L90.51,18.34 L91.50,15.50 L91.50,15.50 L89.49,17.66 L86.65,21.55 L82.02,23.48 L78.34,21.63 L75.43,16.74 Z M71.76,20.66 L64.90,25.73 L54.94,26.81 L42.94,32.89 L43.06,33.11 L55.06,27.19 L65.10,26.27 L72.24,21.34 Z M81.50,23.86 L78.69,34.93 L75.83,49.97 L76.17,50.03 L79.31,35.07 L82.50,24.14 Z M87.49,24.10 L90.74,40.01 L88.86,57.98 L89.14,58.02 L91.26,39.99 L88.51,23.90 Z M62.02,14.71 L45.01,13.85 L44.99,14.15 L61.98,15.29 Z M64.70,16.13 L67.72,23.20 L74.82,29.32 L81.01,31.38 L89.25,28.35 L94.39,22.27 L96.00,18.50 L96.00,18.50 L93.61,21.73 L88.75,27.65 L80.99,30.62 L75.18,28.68 L68.28,22.80 L65.30,15.87 Z M42.98,32.88 L24.99,35.92 L8.00,39.00 L8.00,39.00 L25.01,36.08 L43.02,33.12 Z M75.84,49.95 L69.91,67.97 L66.00,88.00 L66.00,88.00 L70.09,68.03 L76.16,50.05 Z M88.87,58.03 L92.91,75.01 L91.00,95.00 L91.00,95.00 L93.09,74.99 L89.13,57.97 Z M45.03,13.85 L28.00,11.00 L28.00,11.00 L44.97,14.15 Z M47.85,14.08 L52.86,23.14 L61.89,28.22 L74.97,34.30 L88.19,31.33 L97.00,22.00 L97.00,22.00 L87.81,30.67 L75.03,33.70 L62.11,27.78 L53.14,22.86 L48.15,13.92 Z M71.60,20.87 L69.78,26.74 L64.00,28.00 L64.00,28.00 L70.22,27.26 L72.40,21.13 Z M54.83,26.89 L49.92,34.88 L44.00,36.00 L44.00,36.00 L50.08,35.12 L55.17,27.11 Z M78.78,35.22 L82.76,39.14 L85.00,47.00 L85.00,47.00 L83.24,38.86 L79.22,34.78 Z M75.85,49.91 L71.87,56.98 L74.00,65.00 L74.00,65.00 L72.13,57.02 L76.15,50.09 Z M61.75,14.85 L58.89,19.77 L52.00,19.00 L52.00,19.00 L59.11,20.23 L62.25,15.15 Z" fill="url(#shadow-grad)" transform="translate(-0.3, 0.3)" />

          {/* White Crack */}
          <path d="M84.54,14.54 L77.87,21.60 L72.06,20.66 L71.94,21.34 L78.13,22.40 L85.46,15.46 Z M84.38,14.79 L81.60,23.87 L82.40,24.13 L85.62,15.21 Z M84.38,15.21 L87.60,24.13 L88.40,23.87 L85.62,14.79 Z M84.87,14.36 L74.99,16.59 L62.04,14.76 L61.96,15.24 L75.01,17.41 L85.13,15.64 Z M80.53,17.24 L82.85,21.46 L87.31,19.43 L88.50,17.50 L88.50,17.50 L86.69,18.57 L83.15,20.54 L81.47,16.76 Z M74.65,17.21 L77.72,22.31 L81.98,24.42 L87.28,22.37 L90.41,18.28 L91.50,15.50 L91.50,15.50 L89.59,17.72 L86.72,21.63 L82.02,23.58 L78.28,21.69 L75.35,16.79 Z M71.80,20.72 L64.91,25.77 L54.95,26.84 L42.95,32.90 L43.05,33.10 L55.05,27.16 L65.09,26.23 L72.20,21.28 Z M81.59,23.89 L78.75,34.94 L75.85,49.97 L76.15,50.03 L79.25,35.06 L82.41,24.11 Z M87.58,24.08 L90.78,40.01 L88.88,57.99 L89.12,58.01 L91.22,39.99 L88.42,23.92 Z M62.01,14.76 L45.01,13.87 L44.99,14.13 L61.99,15.24 Z M64.75,16.11 L67.77,23.17 L74.85,29.26 L81.01,31.31 L89.20,28.29 L94.32,22.22 L96.00,18.50 L96.00,18.50 L93.68,21.78 L88.80,27.71 L80.99,30.69 L75.15,28.74 L68.23,22.83 L65.25,15.89 Z M42.98,32.89 L24.99,35.93 L8.00,39.00 L8.00,39.00 L25.01,36.07 L43.02,33.11 Z M75.86,49.95 L69.91,67.98 L66.00,88.00 L66.00,88.00 L70.09,68.02 L76.14,50.05 Z M88.88,58.03 L92.92,75.01 L91.00,95.00 L91.00,95.00 L93.08,74.99 L89.12,57.97 Z M45.02,13.87 L28.00,11.00 L28.00,11.00 L44.98,14.13 Z M47.87,14.07 L52.88,23.12 L61.90,28.19 L74.97,34.25 L88.15,31.28 L97.00,22.00 L97.00,22.00 L87.85,30.72 L75.03,33.75 L62.10,27.81 L53.12,22.88 L48.13,13.93 Z M71.67,20.89 L69.82,26.79 L64.00,28.00 L64.00,28.00 L70.18,27.21 L72.33,21.11 Z M54.86,26.91 L49.93,34.89 L44.00,36.00 L44.00,36.00 L50.07,35.11 L55.14,27.09 Z M78.82,35.18 L82.80,39.11 L85.00,47.00 L85.00,47.00 L83.20,38.89 L79.18,34.82 Z M75.87,49.93 L71.88,56.98 L74.00,65.00 L74.00,65.00 L72.12,57.02 L76.13,50.07 Z M61.79,14.88 L58.91,19.81 L52.00,19.00 L52.00,19.00 L59.09,20.19 L62.21,15.12 Z" fill="url(#crack-grad)" />

          {/* Red Light Flow */}
          <path d="M84.15,14.15 L77.74,21.20 L72.12,20.29 L71.88,21.71 L78.26,22.80 L85.85,15.85 Z M83.86,14.62 L81.19,23.73 L82.81,24.27 L86.14,15.38 Z M83.86,15.38 L87.19,24.27 L88.81,23.73 L86.14,14.62 Z M84.76,13.82 L74.98,16.17 L62.08,14.47 L61.92,15.53 L75.02,17.83 L85.24,16.18 Z M80.09,17.46 L82.70,21.91 L87.60,19.83 L88.50,17.50 L88.50,17.50 L86.40,18.17 L83.30,20.09 L81.91,16.54 Z M74.29,17.43 L77.43,22.62 L81.96,24.85 L87.56,22.73 L90.81,18.54 L91.50,15.50 L91.50,15.50 L89.19,17.46 L86.44,21.27 L82.04,23.15 L78.57,21.38 L75.71,16.57 Z M71.58,20.41 L64.81,25.49 L54.89,26.61 L42.88,32.75 L43.12,33.25 L55.11,27.39 L65.19,26.51 L72.42,21.59 Z M81.18,23.78 L78.44,34.87 L75.65,49.93 L76.35,50.07 L79.56,35.13 L82.82,24.22 Z M87.16,24.16 L90.51,40.02 L88.71,57.97 L89.29,58.03 L91.49,39.98 L88.84,23.84 Z M62.03,14.46 L45.02,13.68 L44.98,14.32 L61.97,15.54 Z M64.45,16.23 L67.50,23.37 L74.68,29.57 L81.01,31.67 L89.43,28.60 L94.65,22.45 L96.00,18.50 L96.00,18.50 L93.35,21.55 L88.57,27.40 L80.99,30.33 L75.32,28.43 L68.50,22.63 L65.55,15.77 Z M42.95,32.73 L24.97,35.82 L8.00,39.00 L8.00,39.00 L25.03,36.18 L43.05,33.27 Z M75.66,49.89 L69.79,67.94 L66.00,88.00 L66.00,88.00 L70.21,68.06 L76.34,50.11 Z M88.71,58.07 L92.80,75.01 L91.00,95.00 L91.00,95.00 L93.20,74.99 L89.29,57.93 Z M45.06,13.68 L28.00,11.00 L28.00,11.00 L44.94,14.32 Z M47.69,14.17 L52.72,23.28 L61.78,28.43 L74.94,34.56 L88.33,31.59 L97.00,22.00 L97.00,22.00 L87.67,30.41 L75.06,33.44 L62.22,27.57 L53.28,22.72 L48.31,13.83 Z M71.32,20.77 L69.60,26.54 L64.00,28.00 L64.00,28.00 L70.40,27.46 L72.68,21.23 Z M54.66,26.79 L49.82,34.73 L44.00,36.00 L44.00,36.00 L50.18,35.27 L55.34,27.21 Z M78.59,35.41 L82.55,39.26 L85.00,47.00 L85.00,47.00 L83.45,38.74 L79.41,34.59 Z M75.69,49.82 L71.71,56.96 L74.00,65.00 L74.00,65.00 L72.29,57.04 L76.31,50.18 Z M61.54,14.72 L58.79,19.57 L52.00,19.00 L52.00,19.00 L59.21,20.43 L62.46,15.28 Z" fill="rgba(244, 63, 94, 0.5)" className={alertIndicator === 'bad' ? "animate-crack-flow-bad" : "animate-crack-flow"} />
        </svg>
      )}

      {/* Alert Indicator Dot - Positioned absolutely to mathematically track the 85% 15% origin of the cracks */}
      {alertIndicator && (
        <div 
          className={`absolute w-2.5 h-2.5 rounded-full bg-rose-500 z-20 pointer-events-none ${alertClass} ${alertShadow}`}
          style={{ 
            top: '15%', 
            left: '85%', 
            transform: 'translate(-50%, -50%)',
            /* Nudge it up slightly so it overlaps cracks by ~1/4 of its size as requested */
            marginTop: '-8px',
            marginLeft: '-4px'
          }} 
        />
      )}

      {/* Header Section (Top) */}
      <div className="flex justify-between items-start relative z-10 p-4 pt-3.5 pb-0 w-full">
        <div className={`w-12 h-12 rounded-[20px] ${colors.iconBg} ${colors.iconText} border ${colors.iconBorder} shadow-lg ${colors.iconShadow} flex items-center justify-center`}>
          {icon}
        </div>

        {!alertIndicator && badge ? (
          <div className="px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-white border border-white/5 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            {badge}
          </div>
        ) : null}
      </div>

      {/* Footer Section (Bottom) */}
      <div className="relative z-10 p-4 pb-3.5 pt-0 w-full">
        <h3 
          className="text-white font-semibold"
          style={{ fontSize: '20px', lineHeight: '20px' }}
        >
          {title}
        </h3>
        <div className={`${colors.subtitleText} text-xs mt-1.5 font-medium flex items-center gap-1.5`}>
          {subtitleIcon && <span>{subtitleIcon}</span>}
          {subtitle}
        </div>
      </div>
    </Container>
  );
}
