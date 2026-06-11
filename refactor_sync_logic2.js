const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

const targetLogic = `                let latestSemantic: any = {};
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        latestSemantic = row.semantic_metrics;
                        break;
                    }
                }
                setLatestSemanticMetrics(latestSemantic);`;
                
const replacementLogic = `                let latestSemantic: any = {};
                const seenKeys = new Set<string>();
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        const metrics = Object.values(row.semantic_metrics);
                        for (const m of metrics as any[]) {
                            const isText = isNaN(Number(m.numericValue !== null ? m.numericValue : m.rawValue));
                            const name = m.semanticMeaning || m.originalName;
                            // Unique signature to prevent duplicate metrics of the same type
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

if (c.includes(targetLogic)) {
    c = c.replace(targetLogic, replacementLogic);
    fs.writeFileSync(path, c);
    console.log("Successfully replaced data logic!");
} else {
    console.log("Could not find data logic");
}
