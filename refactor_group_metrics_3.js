const fs = require('fs');

let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const targetStr = `<div className="flex items-baseline gap-1 whitespace-nowrap w-full overflow-hidden">
                                                                            <span className="text-lg sm:text-xl font-bold text-ink truncate">
                                                                                {base.numericValue !== null ? base.numericValue : base.rawValue}
                                                                            </span>
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted truncate">{base.unit}</span>
                                                                            )}
                                                                        </div>`;

const replacementStr = `<div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                            <span className="text-lg sm:text-xl font-bold text-ink">
                                                                                {base.numericValue !== null ? base.numericValue : base.rawValue}
                                                                            </span>
                                                                            {base.unit && (
                                                                                <span className="text-xs font-semibold text-ink-muted">{base.unit}</span>
                                                                            )}
                                                                        </div>`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Successfully removed truncate classes!');
} else {
    console.log('Target string not found in file!');
}
