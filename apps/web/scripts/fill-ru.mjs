import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env.local') });

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ruJsonPath = path.resolve('src/i18n/messages/ru.json');
const ruJson = JSON.parse(fs.readFileSync(ruJsonPath, 'utf8'));

const missingKeys = {};

function collectMissing(obj, path = '') {
  for (const key in obj) {
    const val = obj[key];
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof val === 'string' && val.startsWith('[TODO:')) {
      missingKeys[fullPath] = val;
    } else if (typeof val === 'object' && val !== null) {
      collectMissing(val, fullPath);
    }
  }
}

collectMissing(ruJson);

const keysList = Object.keys(missingKeys);

if (keysList.length === 0) {
  console.log('No missing keys found.');
  process.exit(0);
}

console.log(`Found ${keysList.length} missing keys. Requesting translations...`);

async function translate() {
  const prompt = `
You are an expert UX translator for a Russian health tracking app (Vitograph).
I have a list of JSON keys that are missing their Russian UI text.
Provide a valid JSON object where the keys are the exact same paths (e.g. "medical.premiumAnalysis") and the values are the appropriate, concise, natural Russian UI text.
Do NOT use markdown code blocks \`\`\`json. Just output the raw JSON object.

Keys to translate:
${JSON.stringify(keysList, null, 2)}
  `;

  const { text } = await generateText({
    model: openai('gpt-4o'),
    prompt,
    temperature: 0.1,
  });

  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const translations = JSON.parse(cleanText);

    for (const [fullPath, translatedStr] of Object.entries(translations)) {
      const parts = fullPath.split('.');
      let current = ruJson;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = translatedStr;
    }

    fs.writeFileSync(ruJsonPath, JSON.stringify(ruJson, null, 2), 'utf8');
    console.log('Successfully updated ru.json!');
  } catch (err) {
    console.error('Failed to parse or apply translations:', err);
    console.log('Raw output:', text);
  }
}

translate();
