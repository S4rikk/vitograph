const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

// Nutrient translations keyed by English canonical name
const nutrientTranslations = {
  "Vitamin C":     { ru: "Витамин C", en: "Vitamin C", es: "Vitamina C", de: "Vitamin C", fr: "Vitamine C", ja: "ビタミンC", ko: "비타민 C", pt: "Vitamina C", tr: "C Vitamini", zh: "维生素C", ar: "فيتامين C" },
  "Vitamin D":     { ru: "Витамин D", en: "Vitamin D", es: "Vitamina D", de: "Vitamin D", fr: "Vitamine D", ja: "ビタミンD", ko: "비타민 D", pt: "Vitamina D", tr: "D Vitamini", zh: "维生素D", ar: "فيتامين D" },
  "Vitamin B12":   { ru: "Витамин B12", en: "Vitamin B12", es: "Vitamina B12", de: "Vitamin B12", fr: "Vitamine B12", ja: "ビタミンB12", ko: "비타민 B12", pt: "Vitamina B12", tr: "B12 Vitamini", zh: "维生素B12", ar: "فيتامين B12" },
  "Vitamin B6":    { ru: "Витамин B6", en: "Vitamin B6", es: "Vitamina B6", de: "Vitamin B6", fr: "Vitamine B6", ja: "ビタミンB6", ko: "비타민 B6", pt: "Vitamina B6", tr: "B6 Vitamini", zh: "维生素B6", ar: "فيتامين B6" },
  "Vitamin A":     { ru: "Витамин A", en: "Vitamin A", es: "Vitamina A", de: "Vitamin A", fr: "Vitamine A", ja: "ビタミンA", ko: "비타민 A", pt: "Vitamina A", tr: "A Vitamini", zh: "维生素A", ar: "فيتامين A" },
  "Vitamin E":     { ru: "Витамин E", en: "Vitamin E", es: "Vitamina E", de: "Vitamin E", fr: "Vitamine E", ja: "ビタミンE", ko: "비타민 E", pt: "Vitamina E", tr: "E Vitamini", zh: "维生素E", ar: "فيتامين E" },
  "Folic Acid":    { ru: "Фолиевая кислота", en: "Folic Acid", es: "Ácido fólico", de: "Folsäure", fr: "Acide folique", ja: "葉酸", ko: "엽산", pt: "Ácido fólico", tr: "Folik Asit", zh: "叶酸", ar: "حمض الفوليك" },
  "Calcium":       { ru: "Кальций", en: "Calcium", es: "Calcio", de: "Kalzium", fr: "Calcium", ja: "カルシウム", ko: "칼슘", pt: "Cálcio", tr: "Kalsiyum", zh: "钙", ar: "كالسيوم" },
  "Magnesium":     { ru: "Магний", en: "Magnesium", es: "Magnesio", de: "Magnesium", fr: "Magnésium", ja: "マグネシウム", ko: "마그네슘", pt: "Magnésio", tr: "Magnezyum", zh: "镁", ar: "مغنيسيوم" },
  "Zinc":          { ru: "Цинк", en: "Zinc", es: "Zinc", de: "Zink", fr: "Zinc", ja: "亜鉛", ko: "아연", pt: "Zinco", tr: "Çinko", zh: "锌", ar: "زنك" },
  "Selenium":      { ru: "Селен", en: "Selenium", es: "Selenio", de: "Selen", fr: "Sélénium", ja: "セレン", ko: "셀레늄", pt: "Selênio", tr: "Selenyum", zh: "硒", ar: "سيلينيوم" },
  "Iodine":        { ru: "Йод", en: "Iodine", es: "Yodo", de: "Jod", fr: "Iode", ja: "ヨウ素", ko: "요오드", pt: "Iodo", tr: "İyot", zh: "碘", ar: "يود" },
  "Potassium":     { ru: "Калий", en: "Potassium", es: "Potasio", de: "Kalium", fr: "Potassium", ja: "カリウム", ko: "칼륨", pt: "Potássio", tr: "Potasyum", zh: "钾", ar: "بوتاسيوم" },
  "Sodium":        { ru: "Натрий", en: "Sodium", es: "Sodio", de: "Natrium", fr: "Sodium", ja: "ナトリウム", ko: "나트륨", pt: "Sódio", tr: "Sodyum", zh: "钠", ar: "صوديوم" },
  "Phosphorus":    { ru: "Фосфор", en: "Phosphorus", es: "Fósforo", de: "Phosphor", fr: "Phosphore", ja: "リン", ko: "인", pt: "Fósforo", tr: "Fosfor", zh: "磷", ar: "فوسفور" },
  "Omega-3":       { ru: "Омега-3", en: "Omega-3", es: "Omega-3", de: "Omega-3", fr: "Oméga-3", ja: "オメガ3", ko: "오메가-3", pt: "Ômega-3", tr: "Omega-3", zh: "Omega-3", ar: "أوميغا-3" },
  "Iron":          { ru: "Железо", en: "Iron", es: "Hierro", de: "Eisen", fr: "Fer", ja: "鉄", ko: "철", pt: "Ferro", tr: "Demir", zh: "铁", ar: "حديد" },
};

const locales = ['ru','en','es','de','fr','ja','ko','pt','tr','zh','ar'];

for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  if (!data.nutrients) data.nutrients = {};
  for (const [enKey, translations] of Object.entries(nutrientTranslations)) {
    data.nutrients[enKey] = translations[locale] || translations['en'];
  }

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ ${locale}.json — nutrients namespace added`);
}

console.log('\n🏁 Done — nutrient translations added to all locales');
