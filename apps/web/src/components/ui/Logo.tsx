import React from 'react';

interface LogoProps {
  size?: 'sm' | 'lg';
  showSubtitle?: boolean;
}

export default function Logo({ size = 'sm', showSubtitle = false }: LogoProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-200 -200 400 400" className={size === 'sm' ? "w-8 h-8" : "w-12 h-12"}>
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <g id="fish-outline">
                    <path d="M 15 0 Q 80 -50 160 25 M 15 0 Q 80 50 160 -25" 
                          fill="none" stroke="url(#grad1)" strokeWidth="8" strokeLinecap="round"/>
                </g>
            </defs>
            <g transform="rotate(-90)">
                {/* Section 1 */}
                <g transform="rotate(0)">
                    <use href="#fish-outline" />
                    <line x1="40" y1="-18.77" x2="40" y2="18.77" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="56" y1="-23.69" x2="56" y2="23.69" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="72" y1="-25.76" x2="72" y2="25.76" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="88" y1="-23.78" x2="88" y2="23.78" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="104" y1="-18.73" x2="104" y2="18.73" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="120" y1="-12.75" x2="120" y2="12.75" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                </g>
                {/* Section 2 */}
                <g transform="rotate(120)">
                    <use href="#fish-outline" />
                    <line x1="40" y1="-18.79" x2="40" y2="18.79" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="56" y1="-23.86" x2="56" y2="23.86" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="72" y1="-25.50" x2="72" y2="25.50" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="88" y1="-23.53" x2="88" y2="23.53" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="104" y1="-18.51" x2="104" y2="18.51" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="120" y1="-12.53" x2="120" y2="12.53" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                </g>
                {/* Section 3 */}
                <g transform="rotate(240)">
                    <use href="#fish-outline" />
                    <line x1="40" y1="-18.48" x2="40" y2="18.48" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="56" y1="-23.54" x2="56" y2="23.54" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="72" y1="-25.52" x2="72" y2="25.52" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="88" y1="-23.54" x2="88" y2="23.54" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="104" y1="-18.54" x2="104" y2="18.54" stroke="#10b981" strokeWidth="3" strokeLinecap="round"/>
                    <line x1="120" y1="-12.52" x2="120" y2="12.52" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round"/>
                </g>
                <circle cx="0" cy="0" r="8" fill="#0ea5e9" />
            </g>
        </svg>
        <span className={size === 'sm' ? "-ml-1 font-bold text-lg tracking-tight" : "-ml-1 text-lg font-bold tracking-tight sm:text-3xl"}>
          <span className="text-ink">VITO</span><span className="text-primary-600">GRAPH</span>
        </span>
      </div>
      {showSubtitle && (
        <p className="mt-1 text-sm text-ink-muted text-center hidden sm:block">
          Feed your cells, find balance
        </p>
      )}
    </div>
  );
}
