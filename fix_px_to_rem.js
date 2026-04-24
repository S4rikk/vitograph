const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

let count = 0;
walkDir('apps/web/src/components', (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        let content = fs.readFileSync(filePath, 'utf8');
        const regex = /text-\[(\d+)px\]/g;
        if (regex.test(content)) {
            const newContent = content.replace(regex, (match, p1) => {
                const px = parseInt(p1, 10);
                const rem = px / 16;
                // remove trailing zeros if possible
                return `text-[${rem}rem]`;
            });
            fs.writeFileSync(filePath, newContent, 'utf8');
            count++;
            console.log(`Updated ${filePath}`);
        }
    }
});

console.log(`Finished updating ${count} files.`);
