import fs from 'fs';
import path from 'path';

const files = [
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\profile\\UserProfileSheet.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\ResultCard.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\SomaticAnalysisCard.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\SymptomTrackerWidget.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\UploadZone.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\PhotoUploader.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\NailAnalysisCard.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\MedicalResultsView.tsx",
  "C:\\project\\VITOGRAPH\\apps\\web\\src\\components\\medical\\DiagnosticReportCard.tsx"
];

const keys = new Set();

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf-8');
  // Look for t('someKey') or t("someKey") or t(`someKey`)
  // Also match tMedical
  const regex = /(?:t|tMedical)\(\s*['"`]([^'"`$]+)['"`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!match[1].includes('.')) {
      keys.add(match[1]);
    } else {
      // It might be nested like symptomsList.headache
      keys.add(match[1]);
    }
  }
});

const result = { medical: {} };

for (const key of keys) {
  const parts = key.split('.');
  if (parts.length === 1) {
    result.medical[parts[0]] = "TBD " + parts[0];
  } else if (parts.length === 2) {
    if (!result.medical[parts[0]]) result.medical[parts[0]] = {};
    result.medical[parts[0]][parts[1]] = "TBD " + parts[1];
  }
}

// Write the placeholder object to console
console.log(JSON.stringify(result, null, 2));
