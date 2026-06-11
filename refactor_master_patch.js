const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Add DeleteBadge component
const badgeComp = `const DeleteBadge = ({ onConfirm }: { onConfirm: () => void }) => {
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
    c = c.replace("export default function UserProfileSheet", badgeComp + "\nexport default function UserProfileSheet");
}

// 2. State & Functions
const stateLogic = `    const [isEditingMetrics, setIsEditingMetrics] = useState(false);

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

    // Render`;
if (!c.includes("isEditingMetrics")) {
    c = c.replace(/(\/\/\s*\s*Render\s*)/, stateLogic);
}

// 3. Re-inject deduplication logic inside loadWearables
const dataLogicTarget = `                let latestSemantic: any = {};
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        latestSemantic = row.semantic_metrics;
                        break;
                    }
                }
                setLatestSemanticMetrics(latestSemantic);`;
                
const dataLogicReplacement = `                let latestSemantic: any = {};
                const seenKeys = new Set<string>();
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        const metrics = Object.values(row.semantic_metrics);
                        for (const m of metrics as any[]) {
                            const isText = isNaN(Number(m.numericValue !== null ? m.numericValue : m.rawValue));
                            const name = m.semanticMeaning || m.originalName;
                            const key = \`\${name}_\${isText ? 'text' : 'num'}_\${m.unit || 'nounit'}\`;
                            if (!seenKeys.has(key)) {
                                seenKeys.add(key);
                                const id = m.id || key;
                                latestSemantic[id] = m;
                            }
                        }
                    }
                }
                setLatestSemanticMetrics(latestSemantic);`;
if (c.includes(dataLogicTarget)) c = c.replace(dataLogicTarget, dataLogicReplacement);

// 4. We will replace everything from {Object.keys(latestSemanticMetrics).length === 0 ? ( to the end of the TabsContent
const startRenderStr = `{Object.keys(latestSemanticMetrics).length === 0 ? (`;
const endRenderStr = `                                    </TabsContent>`;

const startIndex = c.indexOf(startRenderStr);
const endIndex = c.indexOf(endRenderStr, startIndex);

if (startIndex > -1 && endIndex > -1) {
    // Generate the massive Garmin replacement
    const replacementRender = fs.readFileSync('C:/project/VITOGRAPH/perfect_render_block.txt', 'utf8');
    c = c.slice(0, startIndex) + replacementRender + "\n" + c.slice(endIndex);
    fs.writeFileSync(path, c);
    console.log("Successfully replaced complete Garmin render logic!");
} else {
    console.log("Could not find start/end bounds for render replacement");
}
