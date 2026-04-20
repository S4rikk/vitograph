const fs = require('fs');

const brokenPath = 'C:/project/VITOGRAPH/apps/api/src/ai/src/ai.controller_broken.ts';
const cleanPath = 'C:/project/VITOGRAPH/apps/api/src/ai/src/ai.controller.ts';

const brokenLines = fs.readFileSync(brokenPath, 'utf8').split('\n');

// The functions start at line 3304 (index 3303). Let's extract from index 3303 to the end.
const functionsCode = "\n" + brokenLines.slice(3303).join('\n');

fs.appendFileSync(cleanPath, functionsCode, 'utf8');

console.log("Functions safely appended to ai.controller.ts");
