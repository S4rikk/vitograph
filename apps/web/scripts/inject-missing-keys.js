const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'messages');

// Keys to add, organized by namespace
const additions = {
  profile: {
    aboutSection: {
      ru: 'О вас',
      en: 'About You',
      es: 'Sobre ti',
      de: 'Über Sie',
      fr: 'À propos de vous',
      ja: 'あなたについて',
      ko: '당신에 대해',
      pt: 'Sobre você',
      tr: 'Hakkınızda',
      zh: '关于您'
    }
  },
  medical: {
    nailsTitle: {
      ru: 'Диагностика ногтей',
      en: 'Nail Diagnostics',
      es: 'Diagnóstico de uñas',
      de: 'Nageldiagnostik',
      fr: 'Diagnostic des ongles',
      ja: '爪の診断',
      ko: '손톱 진단',
      pt: 'Diagnóstico de unhas',
      tr: 'Tırnak Teşhisi',
      zh: '指甲诊断'
    },
    nailsDescription: {
      ru: 'Сфотографируйте ногти крупным планом. ИИ проанализирует цвет, текстуру и форму для выявления возможных дефицитов.',
      en: 'Take a close-up photo of your nails. AI will analyze color, texture and shape to identify potential deficiencies.',
      es: 'Tome una foto de cerca de sus uñas. La IA analizará el color, la textura y la forma para identificar posibles deficiencias.',
      de: 'Fotografieren Sie Ihre Nägel aus der Nähe. Die KI analysiert Farbe, Textur und Form, um mögliche Mängel zu erkennen.',
      fr: "Prenez une photo en gros plan de vos ongles. L'IA analysera la couleur, la texture et la forme pour identifier d'éventuelles carences.",
      ja: '爪のクローズアップ写真を撮ってください。AIが色、質感、形状を分析し、不足の可能性を特定します。',
      ko: '손톱을 가까이에서 촬영해 주세요. AI가 색상, 질감, 형태를 분석하여 잠재적 결핍을 파악합니다.',
      pt: 'Tire uma foto de perto das suas unhas. A IA analisará cor, textura e forma para identificar possíveis deficiências.',
      tr: 'Tırnaklarınızın yakın çekim fotoğrafını çekin. Yapay zeka renk, doku ve şekli analiz ederek olası eksiklikleri belirleyecektir.',
      zh: '拍摄指甲的特写照片。AI将分析颜色、纹理和形状以识别潜在的缺乏。'
    },
    tongueTitle: {
      ru: 'Диагностика языка',
      en: 'Tongue Diagnostics',
      es: 'Diagnóstico de la lengua',
      de: 'Zungendiagnostik',
      fr: 'Diagnostic de la langue',
      ja: '舌の診断',
      ko: '혀 진단',
      pt: 'Diagnóstico da língua',
      tr: 'Dil Teşhisi',
      zh: '舌头诊断'
    },
    tongueDescription: {
      ru: 'Покажите язык при хорошем освещении. ИИ оценит налёт, цвет и текстуру для корреляции с пищеварительным здоровьем.',
      en: 'Show your tongue in good lighting. AI will evaluate coating, color, and texture for correlation with digestive health.',
      es: 'Muestre su lengua con buena iluminación. La IA evaluará el revestimiento, el color y la textura en correlación con la salud digestiva.',
      de: 'Zeigen Sie Ihre Zunge bei guter Beleuchtung. Die KI bewertet Belag, Farbe und Textur in Bezug auf die Verdauungsgesundheit.',
      fr: "Montrez votre langue sous un bon éclairage. L'IA évaluera le revêtement, la couleur et la texture en corrélation avec la santé digestive.",
      ja: '良い照明の下で舌を見せてください。AIが舌苔、色、質感を評価し、消化器の健康との相関を分析します。',
      ko: '좋은 조명에서 혀를 보여주세요. AI가 설태, 색상, 질감을 평가하여 소화기 건강과의 상관관계를 분석합니다.',
      pt: 'Mostre sua língua com boa iluminação. A IA avaliará a saburra, cor e textura em correlação com a saúde digestiva.',
      tr: 'Dilinizi iyi aydınlatma altında gösterin. Yapay zeka, kaplama, renk ve dokuyu sindirim sağlığıyla ilişkilendirerek değerlendirecektir.',
      zh: '在良好光线下展示您的舌头。AI将评估舌苔、颜色和纹理，与消化系统健康进行关联分析。'
    },
    skinTitle: {
      ru: 'Диагностика кожи',
      en: 'Skin Diagnostics',
      es: 'Diagnóstico de la piel',
      de: 'Hautdiagnostik',
      fr: 'Diagnostic de la peau',
      ja: '肌の診断',
      ko: '피부 진단',
      pt: 'Diagnóstico da pele',
      tr: 'Cilt Teşhisi',
      zh: '皮肤诊断'
    },
    skinDescription: {
      ru: 'Сфотографируйте проблемный участок кожи. ИИ определит видимые паттерны: сухость, высыпания, пигментацию.',
      en: 'Take a photo of the problem skin area. AI will identify visible patterns: dryness, rashes, pigmentation.',
      es: 'Tome una foto del área de piel problemática. La IA identificará patrones visibles: sequedad, erupciones, pigmentación.',
      de: 'Fotografieren Sie den problematischen Hautbereich. Die KI erkennt sichtbare Muster: Trockenheit, Ausschläge, Pigmentierung.',
      fr: "Prenez une photo de la zone cutanée problématique. L'IA identifiera les schémas visibles: sécheresse, éruptions, pigmentation.",
      ja: '問題のある肌の部分を撮影してください。AIが乾燥、発疹、色素沈着などの目に見えるパターンを特定します。',
      ko: '문제가 있는 피부 부위를 촬영해 주세요. AI가 건조함, 발진, 색소침착 등의 패턴을 파악합니다.',
      pt: 'Tire uma foto da área de pele problemática. A IA identificará padrões visíveis: ressecamento, erupções, pigmentação.',
      tr: 'Sorunlu cilt bölgesinin fotoğrafını çekin. Yapay zeka görünür desenleri belirleyecektir: kuruluk, döküntüler, pigmentasyon.',
      zh: '拍摄问题皮肤区域的照片。AI将识别可见模式：干燥、皮疹、色素沉着。'
    }
  }
};

const locales = ['ru', 'en', 'es', 'de', 'fr', 'ja', 'ko', 'pt', 'tr', 'zh'];
let totalAdded = 0;

for (const locale of locales) {
  const fp = path.join(dir, locale + '.json');
  if (!fs.existsSync(fp)) {
    console.log(`⚠ Skipping ${locale}.json — file not found`);
    continue;
  }
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));

  for (const [ns, keys] of Object.entries(additions)) {
    if (!data[ns]) data[ns] = {};
    for (const [key, vals] of Object.entries(keys)) {
      if (!data[ns][key]) {
        data[ns][key] = vals[locale] || vals['en'];
        console.log(`✅ Added ${ns}.${key} → ${locale}`);
        totalAdded++;
      } else {
        console.log(`⏭  ${ns}.${key} already exists in ${locale}`);
      }
    }
  }

  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

console.log(`\n🏁 Done. Total keys added: ${totalAdded}`);
