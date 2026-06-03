const fs = require('fs');
let c = fs.readFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// 1. Change metrics: null to metrics: {}
c = c.replace(
    /metrics: null, \/\/ Legacy column/g,
    'metrics: {}, // Legacy column'
);

// 2. Change await loadWearables() or await loadProfile() to setWearablesLoaded(false)
c = c.replace(
    /\/\/ Reload user profile completely to get the latest semantic_metrics\n\s*await loadProfile\(\);/,
    '// Trigger wearables reload\n            setWearablesLoaded(false);'
);
c = c.replace(
    /\/\/ Reload wearables history to get the latest semantic_metrics\n\s*await loadWearables\(\);/,
    '// Trigger wearables reload\n            setWearablesLoaded(false);'
);

// 3. Inject latestSemanticMetrics logic in loadWearables
const hookDef = 'const [latestSemanticMetrics, setLatestSemanticMetrics] = useState<any>({});';
if (!c.includes(hookDef)) {
    c = c.replace(
        /const latestSemanticMetrics = \(profile as any\)\?\.semantic_metrics \|\| \{\};/,
        hookDef
    );
}

// 4. Update the select string
c = c.replace(
    /\.select\('category, metrics, recorded_at'\)/g,
    ".select('category, metrics, semantic_metrics, recorded_at')"
);

// 5. Inject the mapping logic inside loadWearables right before setWearableHistory
const logicToInject = `
                // Extract the freshest semantic_metrics across all categories
                let latestSemantic: any = {};
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        latestSemantic = row.semantic_metrics;
                        break;
                    }
                }
                setLatestSemanticMetrics(latestSemantic);
                
                // Сохраняем полную историю для UI
                setWearableHistory(historyByCategory);`;

// We just find "setWearableHistory(historyByCategory);" and replace it + the comment
if (!c.includes('let latestSemantic: any = {};')) {
    // We can't trust the Russian comment text because of encoding, so let's match just the function call
    c = c.replace(
        /\/\/ [^\n]*\n\s*setWearableHistory\(historyByCategory\);/,
        logicToInject.trim()
    );
}

fs.writeFileSync('C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Done restoring and fixing!');
