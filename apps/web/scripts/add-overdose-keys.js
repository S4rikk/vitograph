const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

// Overdose info translations
const overdoseKeys = {
  overdoseVitaminA: { ru: 'Разовая передозировка может вызвать тошноту. Систематический избыток токсичен для печени.', en: 'Overdose may cause nausea. Chronic excess is toxic to the liver.' },
  overdoseVitaminD: { ru: 'Хроническая передозировка ведёт к слабости и камням в почках.', en: 'Chronic overdose leads to weakness and kidney stones.' },
  overdoseVitaminE: { ru: 'Систематически: риск кровотечений и снижение усвоения других витаминов.', en: 'Chronic: bleeding risk and reduced absorption of other vitamins.' },
  overdoseVitaminC: { ru: 'Систематически: риск образования камней в почках.', en: 'Chronic: risk of kidney stones.' },
  overdoseVitaminB6: { ru: 'Систематический избыток может привести к онемению (нейропатии).', en: 'Chronic excess may lead to numbness (neuropathy).' },
  overdoseFolicAcid: { ru: 'Долгий избыток может маскировать дефицит B12.', en: 'Long-term excess may mask B12 deficiency.' },
  overdoseIron: { ru: 'Накапливается в органах, вызывая поражение печени и сердца.', en: 'Accumulates in organs, causing liver and heart damage.' },
  overdoseCalcium: { ru: 'Риск камней в почках и кальцификации сосудов.', en: 'Risk of kidney stones and vascular calcification.' },
  overdoseMagnesium: { ru: 'Послабляющий эффект, снижение давления.', en: 'Laxative effect, blood pressure drop.' },
  overdoseZinc: { ru: 'Подавляет иммунитет и приводит к дефициту меди.', en: 'Suppresses immunity and leads to copper deficiency.' },
  overdoseSelenium: { ru: 'Ломкость ногтей, выпадение волос.', en: 'Brittle nails, hair loss.' },
  overdoseSodium: { ru: 'Развитие гипертонии и перегрузка сердца.', en: 'Hypertension and heart overload.' },
  overdosePotassium: { ru: 'Нарушение ритма сердца (аритмия).', en: 'Heart rhythm disturbance (arrhythmia).' },
  overdosePhosphorus: { ru: 'Вымывает кальций из костей.', en: 'Leaches calcium from bones.' },
  overdoseOmega3: { ru: 'Снижает свертываемость крови.', en: 'Reduces blood clotting.' },
  overdoseIodine: { ru: 'Может спровоцировать гипертиреоз.', en: 'May trigger hyperthyroidism.' },
};

// Also add overdoseDefault to diary.glycemicSurf
const overdoseDefault = { 
  ru: 'Превышение нормы может быть токсичным для организма',
  en: 'Exceeding the norm may be toxic to the body'
};

const locales = ['ru','en','es','de','fr','ja','ko','pt','tr','zh','ar'];

for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  if (!data.nutrients) data.nutrients = {};
  for (const [key, vals] of Object.entries(overdoseKeys)) {
    data.nutrients[key] = vals[locale] || vals['en'];
  }

  if (!data.diary) data.diary = {};
  if (!data.diary.glycemicSurf) data.diary.glycemicSurf = {};
  data.diary.glycemicSurf.overdoseDefault = overdoseDefault[locale] || overdoseDefault['en'];

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ ${locale}`);
}
console.log('Done');
