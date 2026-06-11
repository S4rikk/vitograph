const fs = require('fs');
const path = 'C:/project/VITOGRAPH/apps/web/src/components/profile/UserProfileSheet.tsx';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(/const rowsToUpdate = historicalRows\.filter/g, `const { data: rows } = await supabase.from('wearable_manual_metrics').select('*').eq('user_id', userId);
            if (!rows) return;
            const rowsToUpdate = rows.filter`);

c = c.replace(/const \{ data \} = await supabase\.from\('wearable_manual_metrics'\)\.select\('\*'\)\.eq\('user_id', userId\)\.order\('recorded_at', \{ ascending: false \}\);\s*if \(data\) setHistoricalRows\(data\);/g, `setWearablesLoaded(false);`);

c = c.replace(/setHistoricalRows\(\[\]\);/g, '');

fs.writeFileSync(path, c);
console.log('Fixed historicalRows and Clock!');
