const fs = require('fs');

let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const targetStr = `return (
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
                                                            );`;

const replacementStr = `return (
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
                                                                        
                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap w-full overflow-hidden">
                                                                            <span className="text-lg sm:text-xl font-bold text-ink truncate">
                                                                                {base.numericValue !== null ? base.numericValue : base.rawValue}
                                                                            </span>
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted truncate">{base.unit}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Successfully updated UI layout!');
} else {
    console.log('Target string not found in file!');
}
