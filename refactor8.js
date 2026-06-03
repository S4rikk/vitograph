const fs = require('fs');
let c = fs.readFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', 'utf8');

const brokenPattern = /<DynamicOcrDialog\s*isOpen=\{ocrResult !== null\}\s*<AlertTriangle size=\{32\} \/>/;

const fixedText = `<DynamicOcrDialog
                isOpen={ocrResult !== null}
                onClose={() => setOcrResult(null)}
                ocrResult={ocrResult}
                onSave={handleDynamicOcrSave}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white dark:bg-surface rounded-3xl max-w-md w-full p-8 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} />`;

if (brokenPattern.test(c)) {
    c = c.replace(brokenPattern, fixedText);
    fs.writeFileSync('apps/web/src/components/profile/UserProfileSheet.tsx', c);
    console.log('Fixed UserProfileSheet.tsx structure successfully.');
} else {
    console.log('Pattern not found.');
}
