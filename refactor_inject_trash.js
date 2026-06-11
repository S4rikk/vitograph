const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

const targetStr = `                                                </button>
                                                <button
                                                    onClick={() => setOcrResult({ detectedCategory: "manual", extractedMetrics: [] })}
                                                    className="w-full sm:w-auto px-6 py-3.5 bg-surface-muted text-ink font-semibold rounded-xl hover:bg-surface-hover transition-all shadow-sm border border-border cursor-pointer whitespace-nowrap"
                                                >
                                                    Ввести вручную
                                                </button>
                                            </div>`;

const replacementStr = `                                                </button>
                                                <div className="flex w-full gap-2">
                                                    <button
                                                        onClick={() => setOcrResult({ detectedCategory: "manual", extractedMetrics: [] })}
                                                        className="flex-1 sm:w-auto px-6 py-3.5 bg-surface-muted text-ink font-semibold rounded-xl hover:bg-surface-hover transition-all shadow-sm border border-border cursor-pointer whitespace-nowrap"
                                                    >
                                                        Ввести вручную
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingMetrics(!isEditingMetrics)}
                                                        className={\`px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] flex items-center justify-center \${isEditingMetrics ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-surface-muted text-ink border-border hover:bg-surface-hover'}\`}
                                                        title="Режим редактирования"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </div>

                                            {isEditingMetrics && (
                                                <div className="flex justify-end mt-2 mb-2">
                                                    <button
                                                        onClick={handleDeleteAllMetrics}
                                                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-semibold transition-colors border border-red-500/20"
                                                    >
                                                        <Trash2 size={16} />
                                                        Удалить всё
                                                    </button>
                                                </div>
                                            )}`;

if (c.includes(targetStr)) {
    c = c.replace(targetStr, replacementStr);
    fs.writeFileSync(path, c);
    console.log("Button injected!");
} else {
    console.log("Could not find target string");
}
