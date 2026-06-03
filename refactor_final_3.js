const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// Fix profileData -> profile
c = c.replace(/const latestSemanticMetrics = profileData\?\.semantic_metrics \|\| \{\};/g, 'const latestSemanticMetrics = (profile as any)?.semantic_metrics || {};');

// Remove duplicate isOcrLoading
c = c.replace(/const \[isOcrLoading, setIsOcrLoading\] = useState\(false\);\n    const \[isOcrLoading, setIsOcrLoading\] = useState\(false\);/, 'const [isOcrLoading, setIsOcrLoading] = useState(false);');

// Let's just find the duplicate manually if the regex above doesn't hit
// We know my injection was:
const injectionStr = `    const [ocrResult, setOcrResult] = useState<any>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const latestSemanticMetrics = (profile as any)?.semantic_metrics || {};\n`;

// Since I injected it near `const [mounted, setMounted] = useState(false);` let's remove my bad injection
c = c.replace(/const \[ocrResult, setOcrResult\] = useState<any>\(null\);\s*const \[isOcrLoading, setIsOcrLoading\] = useState\(false\);\s*const latestSemanticMetrics = [^;]+;/, '');

// Then just add it back once
c = c.replace(/(const \[mounted, setMounted\] = useState\(false\);)/, `$1\n${injectionStr}`);

// But wait, what if the original file HAD `isOcrLoading` down below?
// Let's remove ANY other `const [isOcrLoading, setIsOcrLoading] = useState(false);` that is NOT my injection
let parts = c.split('const [isOcrLoading, setIsOcrLoading] = useState(false);');
if (parts.length > 2) {
    c = parts[0] + 'const [isOcrLoading, setIsOcrLoading] = useState(false);' + parts.slice(1).join('');
}

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed redeclarations');
