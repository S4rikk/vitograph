const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. VO2 Max Widget
const targetVo2 = `                                                                    {/* VO2 Max Widget */}
                                                                    {hasVo2 ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">`;
const replacementVo2 = `                                                                    {/* VO2 Max Widget */}
                                                                    {hasVo2 ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">
                                                                        {isEditingMetrics && (
                                                                            <DeleteBadge onConfirm={() => {
                                                                                if (vo2Numeric) handleDeleteMetric(vo2Numeric.id || \`\${vo2Numeric.originalName || vo2Numeric.semanticMeaning}_\${isNaN(Number(vo2Numeric.numericValue !== null ? vo2Numeric.numericValue : vo2Numeric.rawValue)) ? 'text' : 'num'}_\${vo2Numeric.unit || 'nounit'}\`);
                                                                                if (vo2Text) handleDeleteMetric(vo2Text.id || \`\${vo2Text.originalName || vo2Text.semanticMeaning}_\${isNaN(Number(vo2Text.numericValue !== null ? vo2Text.numericValue : vo2Text.rawValue)) ? 'text' : 'num'}_\${vo2Text.unit || 'nounit'}\`);
                                                                            }} />
                                                                        )}`;
if (c.includes(targetVo2)) c = c.replace(targetVo2, replacementVo2);

// 2. Training Status Widget
const targetTraining = `                                                                    {/* Training Status Widget */}
                                                                    {hasTraining ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">`;
const replacementTraining = `                                                                    {/* Training Status Widget */}
                                                                    {hasTraining ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">
                                                                        {isEditingMetrics && (
                                                                            <DeleteBadge onConfirm={() => {
                                                                                if (trainingStatus) handleDeleteMetric(trainingStatus.id || \`\${trainingStatus.originalName || trainingStatus.semanticMeaning}_\${isNaN(Number(trainingStatus.numericValue !== null ? trainingStatus.numericValue : trainingStatus.rawValue)) ? 'text' : 'num'}_\${trainingStatus.unit || 'nounit'}\`);
                                                                                if (trainingProgress) handleDeleteMetric(trainingProgress.id || \`\${trainingProgress.originalName || trainingProgress.semanticMeaning}_\${isNaN(Number(trainingProgress.numericValue !== null ? trainingProgress.numericValue : trainingProgress.rawValue)) ? 'text' : 'num'}_\${trainingProgress.unit || 'nounit'}\`);
                                                                            }} />
                                                                        )}`;
if (c.includes(targetTraining)) c = c.replace(targetTraining, replacementTraining);

// 3. Fitness & Load
const targetLoad = `                                                                    {hasLoad ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">`;
const replacementLoad = `                                                                    {hasLoad ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">
                                                                        {isEditingMetrics && (
                                                                            <DeleteBadge onConfirm={() => {
                                                                                if (acuteLoad) handleDeleteMetric(acuteLoad.id || \`\${acuteLoad.originalName || acuteLoad.semanticMeaning}_\${isNaN(Number(acuteLoad.numericValue !== null ? acuteLoad.numericValue : acuteLoad.rawValue)) ? 'text' : 'num'}_\${acuteLoad.unit || 'nounit'}\`);
                                                                                if (optimalZoneText) handleDeleteMetric(optimalZoneText.id || \`\${optimalZoneText.originalName || optimalZoneText.semanticMeaning}_\${isNaN(Number(optimalZoneText.numericValue !== null ? optimalZoneText.numericValue : optimalZoneText.rawValue)) ? 'text' : 'num'}_\${optimalZoneText.unit || 'nounit'}\`);
                                                                                if (fitnessStatus) handleDeleteMetric(fitnessStatus.id || \`\${fitnessStatus.originalName || fitnessStatus.semanticMeaning}_\${isNaN(Number(fitnessStatus.numericValue !== null ? fitnessStatus.numericValue : fitnessStatus.rawValue)) ? 'text' : 'num'}_\${fitnessStatus.unit || 'nounit'}\`);
                                                                            }} />
                                                                        )}`;
if (c.includes(targetLoad)) c = c.replace(targetLoad, replacementLoad);

// 4. Recovery
const targetRecovery = `                                                                    {hasRecovery ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">`;
const replacementRecovery = `                                                                    {hasRecovery ? (
                                                                    <div className="bg-gradient-to-br from-surface to-surface/90 p-3 sm:p-4 rounded-3xl border border-white/5 flex flex-col justify-between relative overflow-hidden shadow-lg shadow-black/20">
                                                                        {isEditingMetrics && (
                                                                            <DeleteBadge onConfirm={() => {
                                                                                if (recoveryTime) handleDeleteMetric(recoveryTime.id || \`\${recoveryTime.originalName || recoveryTime.semanticMeaning}_\${isNaN(Number(recoveryTime.numericValue !== null ? recoveryTime.numericValue : recoveryTime.rawValue)) ? 'text' : 'num'}_\${recoveryTime.unit || 'nounit'}\`);
                                                                                if (recoveryNeedText) handleDeleteMetric(recoveryNeedText.id || \`\${recoveryNeedText.originalName || recoveryNeedText.semanticMeaning}_\${isNaN(Number(recoveryNeedText.numericValue !== null ? recoveryNeedText.numericValue : recoveryNeedText.rawValue)) ? 'text' : 'num'}_\${recoveryNeedText.unit || 'nounit'}\`);
                                                                            }} />
                                                                        )}`;
if (c.includes(targetRecovery)) c = c.replace(targetRecovery, replacementRecovery);

// 5. Fallback Groups
const targetFallback = `                                                                                        <div key={idx} className="bg-surface/30 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between hover:bg-surface/50 transition-colors">
                                                                                            <div className="text-[10px] text-ink-muted font-medium mb-1.5 line-clamp-2 leading-tight" title={base.semanticMeaning}>`;
const replacementFallback = `                                                                                        <div key={idx} className="bg-surface/30 p-2.5 rounded-xl border border-white/5 flex flex-col justify-between hover:bg-surface/50 transition-colors relative">
                                                                                            {isEditingMetrics && (
                                                                                                <DeleteBadge onConfirm={() => {
                                                                                                    const bId = base.id || \`\${base.originalName || base.semanticMeaning}_\${isNaN(Number(base.numericValue !== null ? base.numericValue : base.rawValue)) ? 'text' : 'num'}_\${base.unit || 'nounit'}\`;
                                                                                                    handleDeleteMetric(bId);
                                                                                                    if (progress) {
                                                                                                        const pId = progress.id || \`\${progress.originalName || progress.semanticMeaning}_\${isNaN(Number(progress.numericValue !== null ? progress.numericValue : progress.rawValue)) ? 'text' : 'num'}_\${progress.unit || 'nounit'}\`;
                                                                                                        handleDeleteMetric(pId);
                                                                                                    }
                                                                                                }} />
                                                                                            )}
                                                                                            <div className="text-[10px] text-ink-muted font-medium mb-1.5 line-clamp-2 leading-tight" title={base.semanticMeaning}>`;
if (c.includes(targetFallback)) c = c.replace(targetFallback, replacementFallback);

fs.writeFileSync(path, c);
console.log("UI patches 2 applied.");
