const fs = require('fs');
const file = 'c:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove handleWearableSave
content = content.replace(/\/\/ ── Wearable manual entry handler ──[\s\S]*?const handleDynamicOcrSave/, '// ── Wearable handlers ──\n\n    const handleDynamicOcrSave');

// 2. Remove MetricItem arrays and dialogConfig
content = content.replace(/\/\/ ── Build MetricItem arrays for each card ──[\s\S]*?\/\/ ── Render ──/, '// ── Render ──');

// 3. Remove ManualEntryDialog
content = content.replace(/\{\/\* ── Manual Entry Dialogs.*?<\/ManualEntryDialog>\s*\)\}/s, '');

// 4. Update the Wearables Tab UI
const oldTabUiRegex = /\{\/\* ═══ TAB 4: WEARABLES HUB ═══ \*\/\}[\s\S]*?<\/TabsContent>/;
const newTabUi = `                                    {/* ═══ TAB 4: WEARABLES HUB ═══ */}
                                    <TabsContent
                                        value="wearables"
                                        className="!mt-0 relative z-10 bg-white/60 dark:bg-surface/60 backdrop-blur-xl border border-white/70 border-t-transparent shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_10px_20px_-10px_rgba(0,0,0,0.1)] rounded-2xl rounded-tl-none p-5 sm:p-6 space-y-4 focus:outline-none"
                                    >
                                        <div className="flex flex-col gap-6">
                                            {/* Top Action Bar */}
                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                                                <button
                                                    onClick={() => handleScreenshotTrigger()}
                                                    disabled={isOcrLoading}
                                                    className="w-full sm:flex-1 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    {isOcrLoading ? (
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Activity size={20} />
                                                    )}
                                                    Сканировать данные
                                                </button>
                                                <button
                                                    onClick={() => setOcrResult({ detectedCategory: "manual", extractedMetrics: [], confidence: 1 })}
                                                    className="w-full sm:w-auto px-6 py-3.5 bg-surface-muted text-ink font-semibold rounded-xl hover:bg-surface-hover transition-all shadow-sm border border-border cursor-pointer whitespace-nowrap"
                                                >
                                                    Ввести вручную
                                                </button>
                                            </div>

                                            {Object.keys(latestSemanticMetrics).length === 0 ? (
                                                /* Empty State (Zero Data) */
                                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center relative overflow-hidden rounded-3xl bg-surface/80 backdrop-blur-md border border-white/40 shadow-xl">
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary-400/20 rounded-full blur-3xl pointer-events-none" />
                                                    <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-6 relative z-10">
                                                        <Watch size={40} className="text-white" />
                                                    </div>
                                                    <h3 className="text-2xl font-bold text-ink mb-3 relative z-10">
                                                        Умная синхронизация
                                                    </h3>
                                                    <p className="text-ink-muted max-w-sm mx-auto leading-relaxed relative z-10">
                                                        Сделайте скриншот из любого фитнес-приложения (Garmin, Oura, Apple Health). Наш ИИ сам найдет метрики и бережно разложит их по полочкам.
                                                    </p>
                                                </div>
                                            ) : (
                                                /* Filled State */
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                    {Object.values(latestSemanticMetrics).map((metric: any, idx) => (
                                                        <div key={idx} className="bg-white dark:bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                                                            <div className="text-xs text-ink-muted font-medium mb-2 truncate" title={metric.semanticMeaning || metric.originalName}>
                                                                {metric.semanticMeaning || metric.originalName}
                                                            </div>
                                                            <div className="flex items-baseline gap-1 truncate">
                                                                <span className="text-xl font-bold text-ink truncate">
                                                                    {metric.numericValue !== null ? metric.numericValue : metric.rawValue}
                                                                </span>
                                                                {metric.unit && (
                                                                    <span className="text-xs font-semibold text-ink-muted shrink-0">{metric.unit}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </TabsContent>`;
content = content.replace(oldTabUiRegex, newTabUi);

fs.writeFileSync(file, content);
