const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const target = '{ detectedCategory: "manual", extractedMetrics: [], confidence: 1 }';
const replacement = '{ detectedCategory: "manual", extractedMetrics: [] }';

if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Fixed confidence error successfully.');
} else {
    console.log('Could not find confidence target string.');
}
