const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Add Edit button to Top Action Bar
const targetActionBarStart = `                                            {/* Top Action Bar */}
                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                                                <button
                                                    onClick={() => handleScreenshotTrigger("manual" as any)}
                                                    disabled={isOcrLoading}
                                                    className="w-full sm:flex-1 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                                                >
                                                    {isOcrLoading ? (
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Activity size={20} />
                                                    )}
                                                    Сканировать данные
                                                </button>`;

const replacementActionBar = `                                            {/* Top Action Bar */}
                                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                                                <div className="flex w-full gap-2">
                                                    <button
                                                        onClick={() => handleScreenshotTrigger("manual" as any)}
                                                        disabled={isOcrLoading}
                                                        className="flex-1 py-3.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        {isOcrLoading ? (
                                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ) : (
                                                            <Activity size={20} />
                                                        )}
                                                        Сканировать данные
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingMetrics(!isEditingMetrics)}
                                                        className={\`px-4 py-3.5 rounded-xl border transition-all active:scale-[0.98] flex items-center justify-center \${isEditingMetrics ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20' : 'bg-surface-muted text-ink border-border hover:bg-surface-hover'}\`}
                                                        title="Режим редактирования"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>`;

if (c.includes(targetActionBarStart)) c = c.replace(targetActionBarStart, replacementActionBar);


// 2. Add Delete All button before Garmin Dashboard
const targetDashboardStart = `                                                {/* Garmin-Style Dashboard Widgets */}`;
const replacementDashboardStart = `                                                {isEditingMetrics && (
                                                    <div className="flex justify-end mt-4 mb-2">
                                                        <button
                                                            onClick={handleDeleteAllMetrics}
                                                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-semibold transition-colors border border-red-500/20"
                                                        >
                                                            <Trash2 size={16} />
                                                            Удалить всё
                                                        </button>
                                                    </div>
                                                )}
                                                {/* Garmin-Style Dashboard Widgets */}`;

if (c.includes(targetDashboardStart)) c = c.replace(targetDashboardStart, replacementDashboardStart);

// 3. Helper component for the Delete Badge
const helperComponent = `
const DeleteBadge = ({ onConfirm }: { onConfirm: () => void }) => {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            className="absolute -top-2 -right-2 z-20 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 hover:scale-110 active:scale-95 transition-all"
        >
            <X size={12} strokeWidth={3} />
        </button>
    );
};
`;

if (!c.includes("DeleteBadge")) {
    c = c.replace(`export default function UserProfileSheet(`, helperComponent + `\nexport default function UserProfileSheet(`);
}

fs.writeFileSync(path, c);
console.log("UI patches 1 applied.");
