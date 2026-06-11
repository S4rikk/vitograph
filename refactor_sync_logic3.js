const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

const targetRegex = /let latestSemantic: any = {};\s+for \(const row of data\) \{\s+if \(row\.semantic_metrics && Object\.keys\(row\.semantic_metrics\)\.length > 0\) \{\s+latestSemantic = row\.semantic_metrics;\s+break;\s+\}\s+\}\s+setLatestSemanticMetrics\(latestSemantic\);/m;

const replacementLogic = `let latestSemantic: any = {};
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

if (targetRegex.test(c)) {
    c = c.replace(targetRegex, replacementLogic);
    fs.writeFileSync(path, c);
    console.log("Successfully replaced data logic using regex!");
} else {
    console.log("Regex still failed");
}
