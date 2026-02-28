import React from 'react';

interface MealScoreBadgeProps {
    score?: number;
    reason?: string;
}

export function MealScoreBadge({ score, reason }: MealScoreBadgeProps) {
    if (typeof score !== 'number') return null;

    let gradientClass = 'bg-gradient-to-r from-red-400 to-orange-400';
    if (score >= 86) {
        gradientClass = 'bg-gradient-to-r from-teal-400 to-green-500';
    } else if (score >= 70) {
        gradientClass = 'bg-gradient-to-r from-yellow-400 to-green-400';
    } else if (score >= 40) {
        gradientClass = 'bg-gradient-to-r from-orange-400 to-yellow-400';
    }

    return (
        <div className="flex flex-col gap-1.5 mt-2 w-64 max-w-full">
            <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Полезность для твоего организма</span>
                <span className="font-semibold text-gray-700">{score}/100</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                    className={`h-full ${gradientClass} transition-all duration-1000 ease-out`}
                    style={{ width: `${score}%` }}
                />
            </div>

            {reason && (
                <p className="text-[11px] text-gray-500 italic leading-relaxed mt-0.5">
                    {reason}
                </p>
            )}
        </div>
    );
}
