const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// The problematic functions injected inside loadWearables:
const targetFunctions = `
    const handleDeleteMetric = async (metricKey: string) => {
        // Optimistic UI update
        const newMetrics = { ...latestSemanticMetrics };
        delete newMetrics[metricKey];
        setLatestSemanticMetrics(newMetrics);

        // Background DB update
        try {
            const supabase = createClient();
            const rowsToUpdate = historicalRows.filter(row => {
                if (!row.semantic_metrics) return false;
                for (const [id, m] of Object.entries(row.semantic_metrics)) {
                    const isText = isNaN(Number(m.numericValue !== null ? m.numericValue : m.rawValue));
                    const name = m.semanticMeaning || m.originalName;
                    const key = \`\${name}_\${isText ? 'text' : 'num'}_\${m.unit || 'nounit'}\`;
                    const targetId = m.id || key;
                    if (targetId === metricKey) return true;
                }
                return false;
            });

            await Promise.all(rowsToUpdate.map(async (row) => {
                const newSemanticMetrics = { ...row.semantic_metrics };
                let modified = false;
                for (const [id, m] of Object.entries(newSemanticMetrics)) {
                    const isText = isNaN(Number((m as any).numericValue !== null ? (m as any).numericValue : (m as any).rawValue));
                    const name = (m as any).semanticMeaning || (m as any).originalName;
                    const key = \`\${name}_\${isText ? 'text' : 'num'}_\${(m as any).unit || 'nounit'}\`;
                    const targetId = (m as any).id || key;
                    if (targetId === metricKey) {
                        delete newSemanticMetrics[id];
                        modified = true;
                    }
                }
                if (modified) {
                    await supabase.from('wearable_manual_metrics').update({ semantic_metrics: newSemanticMetrics }).eq('id', row.id);
                }
            }));
            
            // Re-fetch to guarantee sync (silent)
            loadWearables();
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
    };`;

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
            
            loadWearables();
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
    };`;

if (c.includes(targetFunctions)) {
    c = c.replace(targetFunctions, ''); // Delete from wrong place
    
    // Insert after loadWearables declaration
    const targetEndLoad = `    useEffect(() => {
        if (activeTab === 'wearables' && userId) {`;
        
    c = c.replace(targetEndLoad, replacementFunctions + '\n\n' + targetEndLoad);
    
    fs.writeFileSync(path, c);
    console.log("Successfully moved and fixed functions");
} else {
    console.log("Could not find target functions!");
}
