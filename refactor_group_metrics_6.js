const fs = require('fs');

let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const targetStr = `<div key={idx} className="bg-white dark:bg-surface py-3 px-2 sm:py-4 sm:px-3 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
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
                                                                        
                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                            {(() => {
                                                                                const val = base.numericValue !== null ? base.numericValue : base.rawValue;
                                                                                const isText = typeof val === 'string' && isNaN(Number(val));
                                                                                return (
                                                                                    <span className={\`font-bold text-ink \${isText ? 'text-xs sm:text-sm' : 'text-lg sm:text-xl'}\`} title={isText ? String(val) : undefined}>
                                                                                        {val}
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted">{base.unit}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>`;

const replacementStr = `<div key={idx} className="bg-white dark:bg-surface p-2 rounded-xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                                                                    <div className="text-[11px] sm:text-xs text-ink-muted font-medium mb-1 line-clamp-2 leading-tight" title={base.semanticMeaning}>
                                                                        {base.originalName || base.semanticMeaning}
                                                                    </div>
                                                                    
                                                                    <div className="mt-auto flex flex-col items-start gap-0.5 w-full">
                                                                        {progress ? (
                                                                            <div className="inline-flex items-center justify-center bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md">
                                                                                {progress.numericValue !== null ? progress.numericValue : progress.rawValue}
                                                                                {progress.unit ? progress.unit : "%"}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="h-4 invisible"></div>
                                                                        )}
                                                                        
                                                                        <div className="flex items-baseline gap-0.5 whitespace-nowrap">
                                                                            {(() => {
                                                                                const val = base.numericValue !== null ? base.numericValue : base.rawValue;
                                                                                const isText = typeof val === 'string' && isNaN(Number(val));
                                                                                return (
                                                                                    <span className={\`font-bold text-ink \${isText ? 'text-[10px] sm:text-[11px]' : 'text-base sm:text-lg'}\`} title={isText ? String(val) : undefined}>
                                                                                        {val}
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                            {base.unit && (
                                                                                <span className="text-[9px] sm:text-[10px] font-medium text-ink-muted">{base.unit}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Successfully optimized metrics cards layout!');
} else {
    console.log('Target string not found!');
}
