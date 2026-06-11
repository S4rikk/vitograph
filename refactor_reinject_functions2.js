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
            
            // Background fetch to sync
            const { data } = await supabase.from('wearable_manual_metrics').select('*').eq('user_id', userId).order('recorded_at', { ascending: false });
            if (data) setHistoricalRows(data);
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

    //  Render 
`;

const targetAnchor = `    //  Render `;
        
if (/Render/.test(c)) {
    c = c.replace(/\/\/.*Render.*\n/,, replacementFunctions);
    fs.writeFileSync(path, c);
    console.log("Functions successfully injected.");
} else {
    console.log("Could not find target strings.");
}
