const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Add states
const targetStates = `    const [latestSemanticMetrics, setLatestSemanticMetrics] = useState<any>({});`;
const replacementStates = `    const [latestSemanticMetrics, setLatestSemanticMetrics] = useState<any>({});
    const [historicalRows, setHistoricalRows] = useState<any[]>([]);
    const [isEditingMetrics, setIsEditingMetrics] = useState(false);`;

if (c.includes(targetStates)) c = c.replace(targetStates, replacementStates);

// 2. Update select query and set historical rows
const targetSelect = `.select('category, metrics, semantic_metrics, recorded_at')`;
const replacementSelect = `.select('id, category, metrics, semantic_metrics, recorded_at')`;
if (c.includes(targetSelect)) c = c.replace(targetSelect, replacementSelect);

const targetSetMetrics = `setLatestSemanticMetrics(latestSemantic);`;
const replacementSetMetrics = `setLatestSemanticMetrics(latestSemantic);
                setHistoricalRows(data);`;
if (c.includes(targetSetMetrics)) c = c.replace(targetSetMetrics, replacementSetMetrics);

// 3. Add deletion functions
const targetFunctions = `    // Extract the freshest semantic_metrics across all categories`;
const deletionFunctions = `
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
    };

    // Extract the freshest semantic_metrics across all categories`;
if (c.includes(targetFunctions) && !c.includes("handleDeleteMetric")) c = c.replace(targetFunctions, deletionFunctions);

fs.writeFileSync(path, c);
console.log("Successfully injected logic states and functions.");
