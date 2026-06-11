const fs = require('fs');

let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const targetStr = `return (
                                                                <div key={idx} className="bg-white dark:bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                                                                    <div className="text-xs text-ink-muted font-medium mb-2 line-clamp-2 leading-tight" title={base.semanticMeaning}>
                                                                        {base.originalName || base.semanticMeaning}
                                                                    </div>
                                                                    
                                                                    <div className="mt-auto flex flex-col items-start gap-1">
                                                                        {progress ? (
                                                                            <div className="inline-flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-md">
                                                                                {progress.numericValue !== null ? progress.numericValue : progress.rawValue}
                                                                                {progress.unit ? progress.unit : "%"}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="h-4 sm:h-5 invisible"></div>
                                                                        )}
                                                                        
                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                            <span className="text-lg sm:text-xl font-bold text-ink">
                                                                                {base.numericValue !== null ? base.numericValue : base.rawValue}
                                                                            </span>
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted">{base.unit}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );`;

const replacementStr = `return (
                                                                <div key={idx} className="bg-white dark:bg-surface py-3 px-2 sm:py-4 sm:px-3 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                                                                    <div className="text-xs text-ink-muted font-medium mb-2 line-clamp-2 leading-tight" title={base.semanticMeaning}>
                                                                        {base.originalName || base.semanticMeaning}
                                                                    </div>
                                                                    
                                                                    <div className="mt-auto flex flex-col items-start gap-1 w-full">
                                                                        {progress ? (
                                                                            <div className="inline-flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold text-[10px] sm:text-xs px-2 py-0.5 rounded-md">
                                                                                {progress.numericValue !== null ? progress.numericValue : progress.rawValue}
                                                                                {progress.unit ? progress.unit : "%"}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="h-4 sm:h-5 invisible"></div>
                                                                        )}
                                                                        
                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap overflow-hidden max-w-full">
                                                                            {(() => {
                                                                                const val = base.numericValue !== null ? base.numericValue : base.rawValue;
                                                                                const isText = typeof val === 'string' && isNaN(Number(val));
                                                                                return (
                                                                                    <span className={\`font-bold text-ink \${isText ? 'text-sm sm:text-base truncate' : 'text-lg sm:text-xl'}\`} title={isText ? String(val) : undefined}>
                                                                                        {val}
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted shrink-0">{base.unit}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Successfully applied UI adjustments!');
} else {
    console.log('Target string not found!');
}
