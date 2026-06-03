const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const stateInjection = `    const [ocrResult, setOcrResult] = useState<any>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const latestSemanticMetrics = profileData?.semantic_metrics || {};\n`;

if (!c.includes('const [ocrResult, setOcrResult]')) {
    c = c.replace(/(const \[mounted, setMounted\] = useState\(false\);)/, `$1\n${stateInjection}`);
}

c = c.replace(/setActiveManualEntry\([^)]*\);?/g, '');

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed final 5 errors!');
