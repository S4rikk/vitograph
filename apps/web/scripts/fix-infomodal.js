const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

const values = {
  ru: 'Vitograph не считает калории. Вместо этого мы отслеживаем <strong>гликемический отклик</strong> — как именно еда влияет на уровень глюкозы в крови и вашу энергию.',
  en: 'Vitograph doesn\'t count calories. Instead, we track <strong>glycemic response</strong> — how food affects your blood glucose level and energy.',
  es: 'Vitograph no cuenta calorías. En su lugar, rastreamos la <strong>respuesta glucémica</strong> — cómo los alimentos afectan tu nivel de glucosa en sangre y tu energía.',
  de: 'Vitograph zählt keine Kalorien. Stattdessen verfolgen wir die <strong>glykämische Reaktion</strong> — wie Nahrung Ihren Blutzuckerspiegel und Ihre Energie beeinflusst.',
  fr: 'Vitograph ne compte pas les calories. Nous suivons plutôt la <strong>réponse glycémique</strong> — comment les aliments affectent votre glycémie et votre énergie.',
  ja: 'Vitographはカロリーを数えません。代わりに<strong>血糖応答</strong>を追跡します — 食べ物が血糖値とエネルギーにどのように影響するかを分析します。',
  ko: 'Vitograph는 칼로리를 계산하지 않습니다. 대신 <strong>혈당 반응</strong>을 추적합니다 — 음식이 혈당 수준과 에너지에 어떤 영향을 미치는지 분석합니다.',
  pt: 'O Vitograph não conta calorias. Em vez disso, rastreamos a <strong>resposta glicêmica</strong> — como os alimentos afetam seu nível de glicose no sangue e sua energia.',
  tr: 'Vitograph kalori saymaz. Bunun yerine <strong>glisemik yanıtı</strong> takip ederiz — yiyeceklerin kan şekeri seviyenizi ve enerjinizi nasıl etkilediğini analiz ederiz.',
  zh: 'Vitograph不计算卡路里。相反，我们跟踪<strong>血糖反应</strong> — 分析食物如何影响您的血糖水平和能量。'
};

const locales = Object.keys(values);
for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!data.diary) data.diary = {};
  if (!data.diary.glycemicSurf) data.diary.glycemicSurf = {};
  data.diary.glycemicSurf.infoModalDesc1 = values[locale];
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ Added diary.glycemicSurf.infoModalDesc1 → ${locale}`);
}
console.log('\n🏁 Done');
