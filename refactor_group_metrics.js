const fs = require('fs');

let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const targetStr = `{Object.values(latestSemanticMetrics).map((metric: any, idx) => (
                                                        <div key={idx} className="bg-white dark:bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                                            <div className="text-xs text-ink-muted font-medium mb-2 line-clamp-2 leading-tight" title={metric.semanticMeaning}>
                                                                {metric.originalName || metric.semanticMeaning}
                                                            </div>
                                                            <div className="flex items-baseline gap-1 flex-wrap">
                                                                <span className="text-lg sm:text-xl font-bold text-ink break-words">
                                                                    {metric.numericValue !== null ? metric.numericValue : metric.rawValue}
                                                                </span>
                                                                {metric.unit && (
                                                                    <span className="text-xs font-semibold text-ink-muted shrink-0">{metric.unit}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}`;

const replacementStr = `{(() => {
                                                        const rawMetrics = Object.values(latestSemanticMetrics) as any[];
                                                        const finalGroups: {base: any, progress?: any}[] = [];
                                                        const usedIndexes = new Set<number>();

                                                        // 1. Group pairs (base + progress)
                                                        rawMetrics.forEach((m1, i) => {
                                                            if (usedIndexes.has(i)) return;
                                                            
                                                            const name1 = (m1.originalName || m1.semanticMeaning || "").toLowerCase();
                                                            const isProgress1 = m1.unit === "%" || name1.includes("progress") || name1.includes("goal");
                                                            
                                                            let matchIdx = -1;
                                                            for (let j = 0; j < rawMetrics.length; j++) {
                                                                if (i === j || usedIndexes.has(j)) continue;
                                                                const m2 = rawMetrics[j];
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
                                                                usedIndexes.add(i);
                                                                usedIndexes.add(matchIdx);
                                                                const m2 = rawMetrics[matchIdx];
                                                                finalGroups.push({
                                                                    base: isProgress1 ? m2 : m1,
                                                                    progress: isProgress1 ? m1 : m2
                                                                });
                                                            }
                                                        });

                                                        // 2. Add remaining & deduplicate
                                                        rawMetrics.forEach((m, i) => {
                                                            if (!usedIndexes.has(i)) {
                                                                const name = (m.originalName || m.semanticMeaning || "").toLowerCase().trim();
                                                                // check exact duplicates by value and similar name
                                                                const isDup = finalGroups.some(g => {
                                                                    const gName = (g.base.originalName || g.base.semanticMeaning || "").toLowerCase().trim();
                                                                    if (name.includes(gName) || gName.includes(name)) {
                                                                        if (m.numericValue !== null && g.base.numericValue !== null && m.numericValue === g.base.numericValue) {
                                                                            return true;
                                                                        }
                                                                        if (m.rawValue === g.base.rawValue) return true;
                                                                    }
                                                                    return false;
                                                                });
                                                                
                                                                if (!isDup) {
                                                                    finalGroups.push({ base: m });
                                                                }
                                                            }
                                                        });

                                                        return finalGroups.map((group, idx) => {
                                                            const { base, progress } = group;
                                                            return (
                                                                <div key={idx} className="bg-white dark:bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                                                                    <div className="text-xs text-ink-muted font-medium mb-2 line-clamp-2 leading-tight pr-8" title={base.semanticMeaning}>
                                                                        {base.originalName || base.semanticMeaning}
                                                                    </div>
                                                                    <div className="flex items-baseline gap-1 flex-wrap mt-auto">
                                                                        <span className="text-lg sm:text-xl font-bold text-ink break-words">
                                                                            {base.numericValue !== null ? base.numericValue : base.rawValue}
                                                                        </span>
                                                                        {base.unit && (
                                                                            <span className="text-xs font-semibold text-ink-muted shrink-0">{base.unit}</span>
                                                                        )}
                                                                    </div>
                                                                    {progress && (
                                                                        <div className="absolute top-3 right-3 flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-bold text-xs px-2 py-1 rounded-lg">
                                                                            {progress.numericValue !== null ? progress.numericValue : progress.rawValue}
                                                                            {progress.unit ? progress.unit : "%"}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        });
                                                    })()}`;

if (c.includes('const rawMetrics = Object.values(latestSemanticMetrics) as any[];')) {
    console.log('Already refactored!');
} else {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Successfully refactored UI grouping!');
}
