import fs from 'fs/promises';
import path from 'path';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const LOCALES = ['en', 'de', 'fr', 'es', 'pt', 'zh', 'ja', 'ko', 'tr'];

// Deep merge function that preserves non-"TODO" values from the existing JSON
function mergeTranslations(source: any, translated: any, existing: any): any {
  if (typeof source !== 'object' || source === null) {
    // If existing has a real translation, keep it
    if (existing !== undefined && existing !== 'TODO') {
      return existing;
    }
    // Otherwise use translated value
    return translated !== undefined ? translated : source;
  }

  const result: any = {};
  for (const key of Object.keys(source)) {
    result[key] = mergeTranslations(
      source[key], 
      translated?.[key], 
      existing?.[key]
    );
  }
  return result;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  const ruPath = path.join(process.cwd(), 'src/i18n/messages/ru.json');
  const ruRaw = await fs.readFile(ruPath, 'utf-8');
  const ruJson = JSON.parse(ruRaw);
  const ruKeys = Object.keys(ruJson).sort();

  console.log(`Starting translation of ${LOCALES.length} locales...`);

  for (const lang of LOCALES) {
    console.log(`\nTranslating to [${lang}]...`);
    const targetPath = path.join(process.cwd(), `src/i18n/messages/${lang}.json`);
    
    let existingJson = {};
    try {
      const existingRaw = await fs.readFile(targetPath, 'utf-8');
      existingJson = JSON.parse(existingRaw);
    } catch (e) {
      console.log(`  No existing ${lang}.json found. Proceeding with empty.`);
    }

    const systemPrompt = `You are an expert medical translator and UI localization specialist. Translate the provided Russian JSON UI dictionary into ${lang}.
Return ONLY a valid JSON object matching the exact structure of the input. Do NOT translate the JSON keys. Only translate the values.
Maintain a professional, empathetic, and clinically accurate tone. VITOGRAPH is a premium health-tracking app.
Do NOT translate variables inside curly braces (e.g., {current}, {target}). Leave them exactly as they are.
${lang === 'en' ? "The English locale uses the Imperial system. If there are words related to metric units in the text (like 'кг', 'см'), translate them to their imperial equivalents in the text ('lbs', 'ft/in')." : ""}
You MUST NOT omit, drop, or truncate any keys from the source JSON. The output must contain every single key present in the input JSON, fully translated.`;

    let retries = 2;
    let translatedJson = null;

    while (retries > 0) {
      try {
        console.log(`  Calling OpenAI API (gpt-4o)...`);
        const { text } = await generateText({
          model: openai('gpt-4o'),
          system: systemPrompt,
          prompt: ruRaw,
        });

        // Clean possible markdown wrappers
        const cleanedText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        translatedJson = JSON.parse(cleanedText);
        break; // Success
      } catch (err: any) {
        console.error(`  Error during generation: ${err.message}`);
        retries--;
        if (retries > 0) {
          console.log(`  Retrying in 5 seconds...`);
          await delay(5000);
        } else {
          console.error(`  Failed to translate ${lang} after retries.`);
        }
      }
    }

    if (translatedJson) {
      console.log(`  Merging translations...`);
      const mergedJson = mergeTranslations(ruJson, translatedJson, existingJson);
      await fs.writeFile(targetPath, JSON.stringify(mergedJson, null, 2), 'utf-8');
      console.log(`  Saved ${lang}.json`);
    }

    console.log(`  Waiting 3 seconds before next locale...`);
    await delay(3000);
  }

  console.log(`\nAll translations finished. Running verification...`);
  verifyTranslations(ruJson, ruKeys);
}

async function verifyTranslations(ruJson: any, ruKeys: string[]) {
  let allValid = true;
  for (const lang of LOCALES) {
    const targetPath = path.join(process.cwd(), `src/i18n/messages/${lang}.json`);
    try {
      const raw = await fs.readFile(targetPath, 'utf-8');
      const json = JSON.parse(raw);
      const keys = Object.keys(json).sort();
      
      const missingKeys = ruKeys.filter(k => !keys.includes(k));
      if (missingKeys.length > 0) {
        console.error(`❌ [${lang}] is missing keys: ${missingKeys.join(', ')}`);
        allValid = false;
      } else {
        console.log(`✅ [${lang}] has all ${ruKeys.length} root keys.`);
      }

      const stringified = JSON.stringify(json);
      if (stringified.includes('"TODO"')) {
        console.warn(`⚠️ [${lang}] still contains "TODO" values.`);
      }
    } catch (err: any) {
      console.error(`❌ [${lang}] failed verification: ${err.message}`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log(`\n🎉 Verification passed for all locales!`);
  } else {
    console.error(`\n⚠️ Verification failed for some locales.`);
  }
}

main().catch(console.error);
