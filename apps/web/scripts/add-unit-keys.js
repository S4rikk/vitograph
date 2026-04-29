const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

const unitTranslations = {
  ru: { mg: "мг", mcg: "мкг", g: "г", iu: "МЕ", kcal: "ккал" },
  en: { mg: "mg", mcg: "mcg", g: "g", iu: "IU", kcal: "kcal" },
  es: { mg: "mg", mcg: "mcg", g: "g", iu: "UI", kcal: "kcal" },
  de: { mg: "mg", mcg: "mcg", g: "g", iu: "IE", kcal: "kcal" },
  fr: { mg: "mg", mcg: "mcg", g: "g", iu: "UI", kcal: "kcal" },
  ja: { mg: "mg", mcg: "mcg", g: "g", iu: "IU", kcal: "kcal" },
  ko: { mg: "mg", mcg: "mcg", g: "g", iu: "IU", kcal: "kcal" },
  pt: { mg: "mg", mcg: "mcg", g: "g", iu: "UI", kcal: "kcal" },
  tr: { mg: "mg", mcg: "mcg", g: "g", iu: "IU", kcal: "kcal" },
  zh: { mg: "毫克", mcg: "微克", g: "克", iu: "IU", kcal: "大卡" },
  ar: { mg: "ملغ", mcg: "مكغ", g: "جم", iu: "وحدة دولية", kcal: "سعرة" }
};

const locales = Object.keys(unitTranslations);
for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  data.units = unitTranslations[locale];

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ ${locale}.json updated with units`);
}
