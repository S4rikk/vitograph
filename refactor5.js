const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// Use regex with \r?\n and \s* to bypass whitespace issues
const brokenTarget = /<\/div>\s*isOpen=\{ocrResult !== null\}/;

const fixedTarget = `</div>

                    {/* Footer */}
                    <div className="p-5 border-t border-border bg-surface z-10 flex items-center justify-between">
                        <span className="text-sm text-success font-semibold transition-opacity min-w-[150px]">
                            {saveSuccess ? tProfile("profileSaved") : ""}
                        </span>
                        <button
                            onClick={() => handleSaveProfile()}
                            disabled={isSaving || loadingProfile}
                            className="px-6 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>{tProfile("saving")}</>) : (tProfile("save"))}</button>
                    </div>
                </div>
            )}

            {/* ── Dynamic OCR Dialog ── */}
            <DynamicOcrDialog
                isOpen={ocrResult !== null}`;

c = c.replace(brokenTarget, fixedTarget);

const manualEntryPattern = /\{\/\*.*?Manual Entry Dialogs.*?\*\/\}\s*\{activeManualEntry[\s\S]*?<\/ManualEntryDialog>\s*\)\}/;
c = c.replace(manualEntryPattern, '');

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed UserProfileSheet.tsx finally');
