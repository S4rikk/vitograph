const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Fix the data merging logic
const targetLogic = `                let latestSemantic: Record<string, any> = {};
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        latestSemantic = row.semantic_metrics;
                        break;
                    }
                }
                setLatestSemanticMetrics(latestSemantic);`;
                
const replacementLogic = `                let latestSemantic: Record<string, any> = {};
                const seenKeys = new Set<string>();
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        const metrics = Object.values(row.semantic_metrics);
                        for (const m of metrics as any[]) {
                            const isText = isNaN(Number(m.numericValue !== null ? m.numericValue : m.rawValue));
                            const name = m.semanticMeaning || m.originalName;
                            // Unique signature to prevent duplicate metrics of the same type
                            const key = \`\${name}_\${isText ? 'text' : 'num'}_\${m.unit || 'nounit'}\`;
                            if (!seenKeys.has(key)) {
                                seenKeys.add(key);
                                const id = m.id || key;
                                latestSemantic[id] = m;
                            }
                        }
                    }
                }
                setLatestSemanticMetrics(latestSemantic);`;

if (c.includes(targetLogic)) {
    c = c.replace(targetLogic, replacementLogic);
} else {
    console.log("Could not find data logic");
}

// 2. Fix the widget rendering conditional logic
const renderTarget = `                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {/* VO2 Max Widget */}
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">`;

const replacementRender = `                                                                {(vo2Numeric || vo2Text || trainingStatus || trainingProgress) && (
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {/* VO2 Max Widget */}
                                                                    { (vo2Numeric || vo2Text) ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">`;

// We also need to add closing tags and conditions for Training Status
// It's easier to just do a full replace of the render block again!
const fullRenderStart = `                                                        return (
                                                            <div className="flex flex-col gap-4">
                                                                <div className="grid grid-cols-2 gap-3">`;

const fullRenderEnd = `                                                        );
                                                    })()}
                                                </div>`;

const startIdx = c.indexOf(fullRenderStart);
const endIdx = c.indexOf(fullRenderEnd, startIdx) + fullRenderEnd.length;

if (startIdx !== -1 && endIdx !== -1) {
    const newRender = `                                                        const hasVo2 = !!(vo2Numeric || vo2Text);
                                                        const hasTraining = !!(trainingStatus || trainingProgress);
                                                        const hasLoad = !!(acuteLoad || load7Day || fitness);
                                                        const hasRecovery = !!(recoveryTime || nextWorkout || recoveryNeeds.length > 0);
                                                        
                                                        return (
                                                            <div className="flex flex-col gap-4">
                                                                {(hasVo2 || hasTraining) && (
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {/* VO2 Max Widget */}
                                                                    {hasVo2 ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">
                                                                        <div className="flex items-center gap-1.5 text-ink-muted text-xs font-semibold mb-4 opacity-70">
                                                                            <Heart size={14} />
                                                                            VO2 Max
                                                                        </div>
                                                                        <div className="flex flex-col items-center">
                                                                            <div className="flex items-baseline gap-1">
                                                                                <span className="text-4xl font-bold text-white tracking-tighter">
                                                                                    {vo2Numeric ? (vo2Numeric.numericValue !== null ? vo2Numeric.numericValue : vo2Numeric.rawValue) : '--'}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-[10px] text-ink-muted font-medium mb-4">
                                                                                {vo2Numeric?.unit || '(mL/kg/min)'}
                                                                            </span>
                                                                            <div className="w-full h-1.5 bg-white/10 rounded-full mb-3 flex overflow-hidden">
                                                                                <div className="w-1/4 bg-red-500"></div>
                                                                                <div className="w-1/4 bg-orange-500"></div>
                                                                                <div className="w-1/4 bg-green-500"></div>
                                                                                <div className="w-1/4 bg-blue-500"></div>
                                                                            </div>
                                                                            {vo2Text && (
                                                                                <div className="text-xs font-bold text-blue-400 tracking-wide uppercase">
                                                                                    {vo2Text.rawValue}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    ) : <div />}
                                                                    
                                                                    {/* Training Status Widget */}
                                                                    {hasTraining ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">
                                                                        <div className="flex items-center justify-center gap-1.5 text-green-500 text-[10px] sm:text-xs font-bold mb-1 tracking-wider uppercase">
                                                                            <Activity size={14} />
                                                                            TRAINING STATUS
                                                                        </div>
                                                                        <div className="text-center">
                                                                            <div className="text-[11px] sm:text-sm font-black text-green-400 tracking-wide uppercase mb-3">
                                                                                {trainingStatus ? trainingStatus.rawValue : 'NO STATUS'}
                                                                            </div>
                                                                            {trainingProgress && (
                                                                                <div className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24">
                                                                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                                                        <path className="text-white/10" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray="100, 100" />
                                                                                        <path className="text-green-500" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" strokeDasharray={\`\${trainingProgress.numericValue || parseInt(trainingProgress.rawValue) || 0}, 100\`} />
                                                                                    </svg>
                                                                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                                        <span className="text-[9px] text-ink-muted font-medium">Progress</span>
                                                                                        <span className="text-sm sm:text-base font-bold text-white">
                                                                                            {trainingProgress.numericValue || trainingProgress.rawValue}%
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    ) : <div />}
                                                                </div>
                                                                )}
                                                                
                                                                {(hasLoad || hasRecovery) && (
                                                                <div className="flex flex-col sm:flex-row gap-4">
                                                                    {/* Fitness & Load (7D) Widget */}
                                                                    {hasLoad && (
                                                                    <div className="flex-1 bg-gradient-to-br from-surface to-surface/90 p-4 rounded-3xl border border-white/5 relative overflow-hidden shadow-lg shadow-black/20">
                                                                        <div className="text-xs font-bold text-white tracking-wide uppercase mb-1">
                                                                            FITNESS & LOAD (7D)
                                                                        </div>
                                                                        <div className="text-[10px] text-ink-muted font-medium flex gap-2 divide-x divide-white/10 mb-6">
                                                                            <span>Acute Load: <span className="font-bold text-white">{acuteLoad ? (acuteLoad.numericValue !== null ? acuteLoad.numericValue : acuteLoad.rawValue) : '--'}</span></span>
                                                                            <span className="pl-2">VO2 Max: <span className="font-bold text-white">{vo2Numeric ? (vo2Numeric.numericValue !== null ? vo2Numeric.numericValue : vo2Numeric.rawValue) : '--'}</span></span>
                                                                        </div>
                                                                        
                                                                        <div className="h-20 w-full flex items-end gap-1 mb-4">
                                                                            {[40, 50, 70, 80, 85, 90, 100].map((h, i) => (
                                                                                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                                                                                    <div className="w-full bg-gradient-to-t from-emerald-500 to-blue-500 rounded-t-sm" style={{ height: \`\${h}%\` }}></div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                                            <span className="text-[11px] font-bold text-white">Optimal Zone</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-ink-muted leading-tight">
                                                                            7-Day Load: {load7Day ? (load7Day.numericValue !== null ? load7Day.numericValue : load7Day.rawValue) : '--'} (Optimal)<br />
                                                                            Fitness: {fitness ? fitness.rawValue : '--'}
                                                                        </div>
                                                                    </div>
                                                                    )}
                                                                    
                                                                    {/* Recovery Time Widget */}
                                                                    {hasRecovery && (
                                                                    <div className="flex-1 bg-gradient-to-br from-surface to-surface/90 p-4 rounded-3xl border border-white/5 relative overflow-hidden shadow-lg shadow-black/20 flex flex-col justify-between">
                                                                        <div>
                                                                            <div className="flex items-center gap-1.5 text-ink-muted text-xs font-semibold mb-4 uppercase tracking-wider">
                                                                                <Clock size={14} className="text-blue-400" />
                                                                                RECOVERY TIME
                                                                            </div>
                                                                            <div className="flex items-baseline gap-1 mb-2">
                                                                                <span className="text-4xl font-bold text-white tracking-tighter">
                                                                                    {recoveryTime ? (recoveryTime.numericValue !== null ? recoveryTime.numericValue : recoveryTime.rawValue) : '--'}
                                                                                </span>
                                                                                <span className="text-xs font-medium text-ink-muted">{recoveryTime?.unit || 'hours'}</span>
                                                                            </div>
                                                                            <div className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full inline-block uppercase tracking-wider mb-4">
                                                                                Recovering
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {nextWorkout && (
                                                                            <div className="flex items-center justify-between bg-black/20 p-3 rounded-2xl border border-white/5 mb-4">
                                                                                <div className="flex flex-col">
                                                                                    <div className="text-[10px] text-ink-muted font-medium mb-0.5">Next Workout</div>
                                                                                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                                                                                        ~{nextWorkout.numericValue !== null ? nextWorkout.numericValue : nextWorkout.rawValue} <span className="text-[10px] font-medium text-ink-muted">{nextWorkout.unit}</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex items-center justify-center">
                                                                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {recoveryNeeds.length > 0 && (
                                                                            <div>
                                                                                <div className="text-[10px] font-semibold text-ink-muted mb-2 uppercase tracking-wide">Recovery Need</div>
                                                                                <div className="flex items-end gap-2 h-16 w-full">
                                                                                    {recoveryNeeds.slice(0, 4).map((m, i) => (
                                                                                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                                                                                            <div className="text-[9px] font-bold text-blue-400">{m.numericValue !== null ? m.numericValue : m.rawValue}{m.unit}</div>
                                                                                            <div className="w-full bg-blue-500 rounded-t-sm opacity-80" style={{ height: \`\${Math.min(100, Math.max(10, ((m.numericValue !== null ? m.numericValue : parseInt(m.rawValue)) / 24) * 100))}%\`, minHeight: '10%' }}></div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    )}
                                                                </div>
                                                                )}
                                                                
                                                                {/* Fallback for remaining metrics */}
                                                                {remainingMetrics.length > 0 && (
                                                                    <div className="mt-2 pt-4">
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                                            {remainingMetrics.map((m, idx) => {
                                                                                const val = m.numericValue !== null ? m.numericValue : m.rawValue;
                                                                                const isText = typeof val === 'string' && isNaN(Number(val));
                                                                                return (
                                                                                    <div key={idx} className="bg-surface/30 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between hover:bg-surface/50 transition-colors">
                                                                                        <div className="text-[10px] text-ink-muted font-medium mb-1.5 line-clamp-2 leading-tight" title={m.semanticMeaning}>
                                                                                            {m.originalName || m.semanticMeaning}
                                                                                        </div>
                                                                                        <div className="flex items-baseline gap-0.5 whitespace-nowrap mt-auto">
                                                                                            <span className={\`font-bold text-white \${isText ? '' : 'text-sm'}\`} style={{ fontSize: isText ? '11px' : undefined }} title={isText ? String(val) : undefined}>
                                                                                                {val}
                                                                                            </span>
                                                                                            {m.unit && <span className="font-medium text-ink-muted" style={{ fontSize: '9px' }}>{m.unit}</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>`;
    
    c = c.substring(0, startIdx) + newRender + c.substring(endIdx);
    fs.writeFileSync(path, c);
    console.log("Successfully fixed sync logic and widget hiding!");
} else {
    console.log("Could not find render block");
}
