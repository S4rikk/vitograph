const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

const targetStart = `                                                                {/* Fallback for remaining metrics */}`;
const targetEnd = `                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>`;

const startIdx = c.indexOf(targetStart);
const endIdx = c.indexOf(targetEnd, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `                                                                {/* Fallback for remaining metrics */}
                                                                {remainingMetrics.length > 0 && (() => {
                                                                    const fallbackGroups: {base: any, progress?: any}[] = [];
                                                                    const usedIdx = new Set<number>();
                                                                    
                                                                    remainingMetrics.forEach((m1, i) => {
                                                                        if (usedIdx.has(i)) return;
                                                                        const name1 = (m1.originalName || m1.semanticMeaning || "").toLowerCase();
                                                                        const isProgress1 = m1.unit === "%" || name1.includes("progress") || name1.includes("goal");
                                                                        
                                                                        let matchIdx = -1;
                                                                        for (let j = 0; j < remainingMetrics.length; j++) {
                                                                            if (i === j || usedIdx.has(j)) continue;
                                                                            const m2 = remainingMetrics[j];
                                                                            const name2 = (m2.originalName || m2.semanticMeaning || "").toLowerCase();
                                                                            const isProgress2 = m2.unit === "%" || name2.includes("progress") || name2.includes("goal");
                                                                            
                                                                            if (isProgress1 === isProgress2) continue;
                                                                            
                                                                            const clean1 = name1.replace(" goal", "").replace(" progress", "").trim();
                                                                            const clean2 = name2.replace(" goal", "").replace(" progress", "").trim();
                                                                            
                                                                            if (clean1 === clean2 || clean1.startsWith(clean2) || clean2.startsWith(clean1)) {
                                                                                matchIdx = j;
                                                                                break;
                                                                            }
                                                                        }
                                                                        
                                                                        if (matchIdx !== -1) {
                                                                            usedIdx.add(i);
                                                                            usedIdx.add(matchIdx);
                                                                            const m2 = remainingMetrics[matchIdx];
                                                                            fallbackGroups.push({
                                                                                base: isProgress1 ? m2 : m1,
                                                                                progress: isProgress1 ? m1 : m2
                                                                            });
                                                                        }
                                                                    });
                                                                    
                                                                    remainingMetrics.forEach((m, i) => {
                                                                        if (!usedIdx.has(i)) fallbackGroups.push({ base: m });
                                                                    });
                                                                    
                                                                    return (
                                                                        <div className="mt-2 pt-4">
                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                                                {fallbackGroups.map((group, idx) => {
                                                                                    const { base, progress } = group;
                                                                                    const val = base.numericValue !== null ? base.numericValue : base.rawValue;
                                                                                    const isText = typeof val === 'string' && isNaN(Number(val));
                                                                                    return (
                                                                                        <div key={idx} className="bg-surface/30 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between hover:bg-surface/50 transition-colors">
                                                                                            <div className="text-[10px] text-ink-muted font-medium mb-1.5 line-clamp-2 leading-tight" title={base.semanticMeaning}>
                                                                                                {base.originalName || base.semanticMeaning}
                                                                                            </div>
                                                                                            <div className="mt-auto flex flex-col items-start gap-1">
                                                                                                {progress ? (
                                                                                                    <div className="inline-flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold text-[10px] px-2 py-0.5 rounded-md">
                                                                                                        {progress.numericValue !== null ? progress.numericValue : progress.rawValue}
                                                                                                        {progress.unit ? progress.unit : "%"}
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <div className="h-4 invisible"></div>
                                                                                                )}
                                                                                                <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                                                                                                    <span className={\`font-bold text-white \${isText ? '' : 'text-sm'}\`} style={{ fontSize: isText ? '11px' : undefined }} title={isText ? String(val) : undefined}>
                                                                                                        {val}
                                                                                                    </span>
                                                                                                    {base.unit && <span className="font-medium text-ink-muted" style={{ fontSize: '9px' }}>{base.unit}</span>}
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })()}`;
                                                                
    c = c.substring(0, startIdx) + replacement + "\n" + c.substring(endIdx);
    fs.writeFileSync(path, c);
    console.log("Successfully injected fallback grouping logic!");
} else {
    console.log("Could not find block boundaries!");
}
