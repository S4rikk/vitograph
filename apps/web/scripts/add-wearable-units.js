const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

const unitTranslations = {
  ru: { h: "ч", ms: "мс", brpm: "вд/мин", bpm: "уд/мин", mlKgMin: "мл/кг/мин", kcal: "ккал", mmHg: "мм рт.ст.", kg: "кг", index: "индекс", mmolL: "ммоль/л" },
  en: { h: "h", ms: "ms", brpm: "brpm", bpm: "bpm", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "index", mmolL: "mmol/L" },
  es: { h: "h", ms: "ms", brpm: "rpm", bpm: "lpm", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "índice", mmolL: "mmol/L" },
  de: { h: "Std", ms: "ms", brpm: "Atemzüge/min", bpm: "S/min", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "Index", mmolL: "mmol/l" },
  fr: { h: "h", ms: "ms", brpm: "resp/min", bpm: "bpm", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "indice", mmolL: "mmol/L" },
  ja: { h: "時間", ms: "ミリ秒", brpm: "回/分", bpm: "bpm", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "インデックス", mmolL: "mmol/L" },
  ko: { h: "시간", ms: "ms", brpm: "회/분", bpm: "bpm", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "지수", mmolL: "mmol/L" },
  pt: { h: "h", ms: "ms", brpm: "irpm", bpm: "bpm", mlKgMin: "ml/kg/min", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "índice", mmolL: "mmol/L" },
  tr: { h: "sa", ms: "ms", brpm: "nefes/dk", bpm: "bpm", mlKgMin: "ml/kg/dk", kcal: "kcal", mmHg: "mmHg", kg: "kg", index: "indeks", mmolL: "mmol/L" },
  zh: { h: "小时", ms: "毫秒", brpm: "次/分", bpm: "次/分", mlKgMin: "毫升/千克/分钟", kcal: "大卡", mmHg: "毫米汞柱", kg: "公斤", index: "指数", mmolL: "毫摩尔/升" },
  ar: { h: "س", ms: "ملي ثانية", brpm: "نفس/دقيقة", bpm: "نبضة/دقيقة", mlKgMin: "مل/كغ/دقيقة", kcal: "سعرة", mmHg: "ملم زئبق", kg: "كغ", index: "مؤشر", mmolL: "مليمول/لتر" }
};

const locales = Object.keys(unitTranslations);
for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  if (!data.wearables) data.wearables = {};
  data.wearables.units = unitTranslations[locale];

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ ${locale}.json updated with wearable units`);
}
