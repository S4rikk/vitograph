const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// 1. Change latestSemanticMetrics
c = c.replace(
    /const latestSemanticMetrics = \(profile as any\)\?\.semantic_metrics \|\| \{\};/,
    'const [latestSemanticMetrics, setLatestSemanticMetrics] = useState<any>({});'
);

// 2. Change loadWearables select
c = c.replace(
    /\.select\('category, metrics, recorded_at'\)/,
    ".select('category, metrics, semantic_metrics, recorded_at')"
);

// 3. Inject setting latestSemanticMetrics
const historyLogic = `                // ?:???? ?>??? ?'??? ?>? UI
                setWearableHistory(historyByCategory);`;

const newLogic = `                // Extract the freshest semantic_metrics across all categories
                let latestSemantic: any = {};
                for (const row of data) {
                    if (row.semantic_metrics && Object.keys(row.semantic_metrics).length > 0) {
                        // Assuming semantic_metrics is an array of extracted metrics
                        latestSemantic = row.semantic_metrics;
                        break; // since data is ordered by recorded_at descending
                    }
                }
                setLatestSemanticMetrics(latestSemantic);
                
                // ?:???? ?>??? ?'??? ?>? UI
                setWearableHistory(historyByCategory);`;

if (!c.includes('let latestSemantic: any = {};')) {
    c = c.replace(historyLogic, newLogic);
}

// 4. Update loadWearables dependencies
// Wait, loadWearables doesn't have dependencies, it's called inside a useEffect.
// The useEffect calls `loadWearables();`

// 5. In handleDynamicOcrSave, change `await loadProfile();` to `await loadWearables();`
// so that it refreshes the wearables list instead of profile!
c = c.replace(
    /\/\/ Reload user profile completely to get the latest semantic_metrics\s*await loadProfile\(\);/,
    '// Reload wearables history to get the latest semantic_metrics\n            await loadWearables();'
);

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed semantic metrics loading');
