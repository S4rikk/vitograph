const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

// Russian translations for all TODO keys
const ruValues = {
  "diary.chatMessage.thinkAboutIt": "Подумаю над этим...",
  "diary.feedback.fileTooLarge": "Файл слишком большой",
  "diary.feedback.uploadFailed": "Ошибка загрузки",
  "diary.feedback.thanks": "Спасибо за отзыв!",
  "diary.feedback.tooManyRequests": "Слишком много запросов, попробуйте позже",
  "diary.feedback.genericError": "Произошла ошибка",
  "diary.feedback.reportBug": "Сообщить об ошибке",
  "diary.feedback.dialogTitle": "Обратная связь",
  "diary.feedback.dialogDesc": "Помогите нам стать лучше",
  "diary.feedback.categoryBug": "Баг",
  "diary.feedback.categorySuggestion": "Предложение",
  "diary.feedback.placeholder": "Опишите проблему или идею...",
  "diary.feedback.attachScreenshot": "Прикрепить скриншот",
  "diary.feedback.cancel": "Отмена",
  "diary.feedback.sending": "Отправка...",
  "diary.feedback.send": "Отправить",
  "diary.glycemicSurf.insulinSurfingTitle": "Гликемический сёрфинг",
  "diary.glycemicSurf.insulinSurfingSubtitle": "Динамика глюкозы за день",
  "diary.glycemicSurf.mgDl": "мг/дл",
  "diary.glycemicSurf.hoursShort": "ч",
  "diary.glycemicSurf.thresholds": "Пороги",
  "diary.glycemicSurf.personalThresholds": "Персональные пороги",
  "diary.glycemicSurf.optimalThreshold": "Оптимальный",
  "diary.glycemicSurf.elevatedThreshold": "Повышенный",
  "diary.glycemicSurf.thresholdsEnhanced": "Расширенные пороги",
  "diary.glycemicSurf.emptyChartTitle": "Пока нет данных",
  "diary.glycemicSurf.emptyChartDesc": "Добавьте приёмы пищи, чтобы увидеть гликемическую кривую",
  "diary.glycemicSurf.maxSpike": "Макс. скачок",
  "diary.glycemicSurf.inGreenZone": "В зелёной зоне",
  "diary.glycemicSurf.hours": "часов",
  "diary.glycemicSurf.averageValue": "Среднее значение",
  "diary.glycemicSurf.micronutrientsTitle": "Микронутриенты",
  "diary.glycemicSurf.outOf16Tracked": "из 16 отслеживаемых",
  "diary.glycemicSurf.dailyNormCoverage": "Покрытие дневной нормы",
  "diary.glycemicSurf.averageValueDesc": "Среднее покрытие дневной нормы по всем нутриентам",
  "diary.glycemicSurf.vitamins": "Витамины",
  "diary.glycemicSurf.minerals": "Минералы",
  "diary.glycemicSurf.glycemicSurfingFooter": "Данные рассчитаны на основе вашего дневника питания",
  "diary.glycemicSurf.infoModalTitle": "Как читать график",
  "diary.glycemicSurf.infoModalWhyTitle": "Зачем следить за глюкозой?",
  "diary.glycemicSurf.infoModalWhyDesc": "Стабильная глюкоза — это ровная энергия, хорошее настроение и отсутствие тяги к сладкому. Резкие скачки провоцируют усталость, набор веса и воспаление.",
  "diary.glycemicSurf.infoModalCaloriesTitle": "Причём тут калории?",
  "diary.glycemicSurf.infoModalCaloriesDesc": "Vitograph не считает калории — он оценивает, как еда влияет на вашу глюкозу и энергию. Два блюда с одинаковой калорийностью могут давать совершенно разный гликемический ответ.",
  "diary.glycemicSurf.infoModalHowToReadTitle": "Как читать зоны",
  "diary.glycemicSurf.infoModalGreenZone": "Зелёная зона",
  "diary.glycemicSurf.infoModalGreenDesc": "Оптимальный уровень глюкозы. Еда усваивается мягко, энергия стабильна.",
  "diary.glycemicSurf.infoModalYellowZone": "Жёлтая зона",
  "diary.glycemicSurf.infoModalYellowDesc": "Умеренный скачок глюкозы. Допустимо, но не идеально.",
  "diary.glycemicSurf.infoModalRedZone": "Красная зона",
  "diary.glycemicSurf.infoModalRedDesc": "Резкий скачок глюкозы. Может вызвать усталость и тягу к сладкому.",
  "diary.glycemicSurf.infoModalBenefitTitle": "Что это даёт?",
  "diary.glycemicSurf.infoModalBenefitDesc": "Понимая свой гликемический профиль, вы можете выбирать еду, которая даёт стабильную энергию на весь день.",
  "diary.mealScore.healthScoreLabel": "Оценка здоровья"
};

// English translations
const enValues = {
  "diary.chatMessage.thinkAboutIt": "Let me think about it...",
  "diary.feedback.fileTooLarge": "File is too large",
  "diary.feedback.uploadFailed": "Upload failed",
  "diary.feedback.thanks": "Thank you for your feedback!",
  "diary.feedback.tooManyRequests": "Too many requests, please try later",
  "diary.feedback.genericError": "An error occurred",
  "diary.feedback.reportBug": "Report a bug",
  "diary.feedback.dialogTitle": "Feedback",
  "diary.feedback.dialogDesc": "Help us improve",
  "diary.feedback.categoryBug": "Bug",
  "diary.feedback.categorySuggestion": "Suggestion",
  "diary.feedback.placeholder": "Describe the issue or idea...",
  "diary.feedback.attachScreenshot": "Attach screenshot",
  "diary.feedback.cancel": "Cancel",
  "diary.feedback.sending": "Sending...",
  "diary.feedback.send": "Send",
  "diary.glycemicSurf.insulinSurfingTitle": "Glycemic Surfing",
  "diary.glycemicSurf.insulinSurfingSubtitle": "Daily glucose dynamics",
  "diary.glycemicSurf.mgDl": "mg/dL",
  "diary.glycemicSurf.hoursShort": "h",
  "diary.glycemicSurf.thresholds": "Thresholds",
  "diary.glycemicSurf.personalThresholds": "Personal thresholds",
  "diary.glycemicSurf.optimalThreshold": "Optimal",
  "diary.glycemicSurf.elevatedThreshold": "Elevated",
  "diary.glycemicSurf.thresholdsEnhanced": "Enhanced thresholds",
  "diary.glycemicSurf.emptyChartTitle": "No data yet",
  "diary.glycemicSurf.emptyChartDesc": "Add meals to see your glycemic curve",
  "diary.glycemicSurf.maxSpike": "Max spike",
  "diary.glycemicSurf.inGreenZone": "In green zone",
  "diary.glycemicSurf.hours": "hours",
  "diary.glycemicSurf.averageValue": "Average value",
  "diary.glycemicSurf.micronutrientsTitle": "Micronutrients",
  "diary.glycemicSurf.outOf16Tracked": "of 16 tracked",
  "diary.glycemicSurf.dailyNormCoverage": "Daily norm coverage",
  "diary.glycemicSurf.averageValueDesc": "Average daily norm coverage across all nutrients",
  "diary.glycemicSurf.vitamins": "Vitamins",
  "diary.glycemicSurf.minerals": "Minerals",
  "diary.glycemicSurf.glycemicSurfingFooter": "Data calculated from your food diary",
  "diary.glycemicSurf.infoModalTitle": "How to read the chart",
  "diary.glycemicSurf.infoModalWhyTitle": "Why track glucose?",
  "diary.glycemicSurf.infoModalWhyDesc": "Stable glucose means steady energy, good mood, and no sugar cravings. Sharp spikes cause fatigue, weight gain, and inflammation.",
  "diary.glycemicSurf.infoModalCaloriesTitle": "What about calories?",
  "diary.glycemicSurf.infoModalCaloriesDesc": "Vitograph doesn't count calories — it evaluates how food affects your glucose and energy. Two meals with equal calories can produce very different glycemic responses.",
  "diary.glycemicSurf.infoModalHowToReadTitle": "How to read zones",
  "diary.glycemicSurf.infoModalGreenZone": "Green zone",
  "diary.glycemicSurf.infoModalGreenDesc": "Optimal glucose level. Food is absorbed gently, energy is stable.",
  "diary.glycemicSurf.infoModalYellowZone": "Yellow zone",
  "diary.glycemicSurf.infoModalYellowDesc": "Moderate glucose spike. Acceptable but not ideal.",
  "diary.glycemicSurf.infoModalRedZone": "Red zone",
  "diary.glycemicSurf.infoModalRedDesc": "Sharp glucose spike. May cause fatigue and sugar cravings.",
  "diary.glycemicSurf.infoModalBenefitTitle": "What's the benefit?",
  "diary.glycemicSurf.infoModalBenefitDesc": "Understanding your glycemic profile helps you choose food that provides stable energy throughout the day.",
  "diary.mealScore.healthScoreLabel": "Health Score"
};

function setNestedKey(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const locales = ['ru','en','es','de','fr','ja','ko','pt','tr','zh'];
let total = 0;

for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const values = locale === 'ru' ? ruValues : enValues;

  for (const [dotKey, val] of Object.entries(values)) {
    setNestedKey(data, dotKey, val);
    total++;
  }

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`✅ ${locale}.json — ${Object.keys(values).length} keys filled`);
}

console.log(`\n🏁 Total: ${total} keys written across ${locales.length} files`);
