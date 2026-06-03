const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

// 1. Import DynamicOcrDialog
if (!c.includes('import DynamicOcrDialog')) {
    c = c.replace(/(import { [^}]+ } from "lucide-react";\s*)/, `$1import DynamicOcrDialog from "./DynamicOcrDialog";\n`);
}

// 2. Fix handleScreenshotChange
const brokenOcrChange = /setOcrInitialValues\(stringValues\);\s*\/\/[^\n]*\s*toast\.success\(tProfile\("ocrSuccess"\)\);/;
const fixedOcrChange = `setOcrResult(parsedResult);
            toast.success(tProfile("ocrSuccess"));`;
c = c.replace(brokenOcrChange, fixedOcrChange);

// 3. Add handleDynamicOcrSave
const handleDynamicOcrSave = `    const handleDynamicOcrSave = async (payload: any) => {
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('wearable_manual_metrics')
                .insert({
                    user_id: userId,
                    category: payload.detectedCategory,
                    metrics: null, // Legacy column
                    semantic_metrics: payload.extractedMetrics,
                    recorded_at: new Date().toISOString(),
                });
            
            if (error) throw error;
            
            // Reload user profile completely to get the latest semantic_metrics
            await loadProfile();
            setOcrResult(null);
            toast.success(tProfile("ocrSuccess")); // Or custom translated save success
        } catch (err) {
            console.error('[Wearable] Save failed:', err);
            toast.error(tProfile("ocrError"));
        }
    };\n\n`;

if (!c.includes('handleDynamicOcrSave')) {
    c = c.replace(/(const handleScreenshotTrigger = )/, handleDynamicOcrSave + '$1');
}

// 4. Render DynamicOcrDialog
const dialogRender = `            <DynamicOcrDialog
                isOpen={ocrResult !== null}
                onClose={() => setOcrResult(null)}
                ocrResult={ocrResult}
                onSave={handleDynamicOcrSave}
            />\n\n            {/* Delete Confirmation Modal */}`;

if (!c.includes('<DynamicOcrDialog')) {
    c = c.replace(/\{\/\*\s*Delete Confirmation Modal\s*\*\/\}/, dialogRender);
}

fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
console.log('Fixed OCR flow');
