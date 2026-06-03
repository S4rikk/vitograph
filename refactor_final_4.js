const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// Remove the injected latestSemanticMetrics
c = c.replace(/const latestSemanticMetrics = \(profile as any\)\?\.semantic_metrics \|\| \{\};\r?\n/, '');

// Add it right after profile is declared
c = c.replace(/(const \[profile, setProfile\] = useState<Record<string, unknown> \| null>\(null\);)/, `$1\n    const latestSemanticMetrics = (profile as any)?.semantic_metrics || {};`);

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Moved latestSemanticMetrics down');
