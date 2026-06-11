const fs = require('fs');

let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const targetStr = `                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap overflow-hidden max-w-full">
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
                                                                        </div>`;

const replacementStr = `                                                                        <div className="flex items-baseline gap-1 whitespace-nowrap">
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
                                                                        </div>`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Successfully fixed the truncation issue!');
} else {
    console.log('Target string not found in file!');
}
