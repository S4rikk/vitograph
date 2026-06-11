const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

const replacementFunctions = `
    const handleDeleteMetric = async (metricKey: string) => {
        const newMetrics = { ...latestSemanticMetrics };
        delete newMetrics[metricKey];
        setLatestSemanticMetrics(newMetrics);

        try {
            const supabase = createClient();
            const rowsToUpdate = historicalRows.filter(row => {
                if (!row.semantic_metrics) return false;
                for (const [id, m] of Object.entries(row.semantic_metrics)) {
                    const anyM = m as any;
                    const isText = isNaN(Number(anyM.numericValue !== null ? anyM.numericValue : anyM.rawValue));
                    const name = anyM.semanticMeaning || anyM.originalName;
                    const key = \`\${name}_\${isText ? 'text' : 'num'}_\${anyM.unit || 'nounit'}\`;
                    const targetId = anyM.id || key;
                    if (targetId === metricKey) return true;
                }
                return false;
            });

            await Promise.all(rowsToUpdate.map(async (row) => {
                const newSemanticMetrics = { ...row.semantic_metrics };
                let modified = false;
                for (const [id, m] of Object.entries(newSemanticMetrics)) {
                    const anyM = m as any;
                    const isText = isNaN(Number(anyM.numericValue !== null ? anyM.numericValue : anyM.rawValue));
                    const name = anyM.semanticMeaning || anyM.originalName;
                    const key = \`\${name}_\${isText ? 'text' : 'num'}_\${anyM.unit || 'nounit'}\`;
                    const targetId = anyM.id || key;
                    if (targetId === metricKey) {
                        delete newSemanticMetrics[id];
                        modified = true;
                    }
                }
                if (modified) {
                    await supabase.from('wearable_manual_metrics').update({ semantic_metrics: newSemanticMetrics }).eq('id', row.id);
                }
            }));
            
            // Note: we can't call loadWearables() here because it's defined inside the useEffect, but we don't need to because optimistic UI is enough.
        } catch (e) {
            console.error("Failed to delete metric", e);
        }
    };

    const handleDeleteAllMetrics = async () => {
        if (!confirm("Вы уверены, что хотите удалить все метрики? Это действие нельзя отменить.")) return;
        setLatestSemanticMetrics({});
        setHistoricalRows([]);
        setIsEditingMetrics(false);
        try {
            const supabase = createClient();
            await supabase.from('wearable_manual_metrics').delete().eq('user_id', userId);
        } catch (e) {
            console.error("Failed to delete all metrics", e);
        }
    };

`;

const targetEndLoad = `    useEffect(() => {
        if (activeTab !== 'wearables' || wearablesLoaded) return;`;
        
if (c.includes(targetEndLoad)) {
    c = c.replace(targetEndLoad, replacementFunctions + targetEndLoad);
    fs.writeFileSync(path, c);
    console.log("Functions successfully injected.");
} else {
    console.log("Could not find target strings.");
}
