export const MICRONUTRIENT_NAME_MAPPING: Record<string, string> = {
  'vitamin c': 'Vitamin C', 'vitamin c (mg)': 'Vitamin C',
  'iron': 'Iron', 'iron (mg)': 'Iron',
  'vitamin d': 'Vitamin D', 'vitamin d (iu)': 'Vitamin D', 'vitamin d (mcg)': 'Vitamin D',
  'vitamin b12': 'Vitamin B12', 'vitamin b12 (mcg)': 'Vitamin B12',
  'vitamin b6': 'Vitamin B6', 'vitamin b6 (mg)': 'Vitamin B6',
  'vitamin a': 'Vitamin A', 'vitamin a (mcg)': 'Vitamin A', 'vitamin a (iu)': 'Vitamin A',
  'vitamin e': 'Vitamin E', 'vitamin e (mg)': 'Vitamin E',
  'folate': 'Folic Acid', 'folic acid': 'Folic Acid', 'folate (mcg)': 'Folic Acid',
  'calcium': 'Calcium', 'calcium (mg)': 'Calcium',
  'magnesium': 'Magnesium', 'magnesium (mg)': 'Magnesium',
  'zinc': 'Zinc', 'zinc (mg)': 'Zinc',
  'selenium': 'Selenium', 'selenium (mcg)': 'Selenium',
  'iodine': 'Iodine', 'iodine (mcg)': 'Iodine',
  'potassium': 'Potassium', 'potassium (mg)': 'Potassium',
  'sodium': 'Sodium', 'sodium (mg)': 'Sodium',
  'phosphorus': 'Phosphorus', 'phosphorus (mg)': 'Phosphorus',
  'oemga-3': 'Omega-3', 'omega-3': 'Omega-3', 'omega 3': 'Omega-3', 'dha': 'Omega-3', 'epa': 'Omega-3',
  // Russian raw keys from AI responses (with and without units)
  'витамин c': 'Vitamin C', 'витамин c (мг)': 'Vitamin C', 'витамин c (mg)': 'Vitamin C', 'витамин с': 'Vitamin C',
  'витамин а': 'Vitamin A', 'витамин a': 'Vitamin A', 'витамин a (мкг)': 'Vitamin A',
  'витамин е': 'Vitamin E', 'витамин e': 'Vitamin E', 'витамин e (мг)': 'Vitamin E',
  'витамин д': 'Vitamin D', 'витамин d': 'Vitamin D', 'витамин d (мкг)': 'Vitamin D',
  'витамин b12': 'Vitamin B12', 'витамин б12': 'Vitamin B12', 'витамин b12 (мкг)': 'Vitamin B12',
  'витамин b6': 'Vitamin B6', 'витамин б6': 'Vitamin B6', 'витамин b6 (мг)': 'Vitamin B6',
  'фолиевая кислота': 'Folic Acid', 'фолиевая кислота (мкг)': 'Folic Acid',
  'железо': 'Iron', 'железо (мг)': 'Iron', 'железо (mg)': 'Iron',
  'кальций': 'Calcium', 'кальций (mg)': 'Calcium', 'кальций (мг)': 'Calcium',
  'магний': 'Magnesium', 'магний (mg)': 'Magnesium', 'магний (мг)': 'Magnesium',
  'цинк': 'Zinc', 'цинк (mg)': 'Zinc', 'цинк (мг)': 'Zinc',
  'селен': 'Selenium', 'селен (мкг)': 'Selenium', 'селен (mcg)': 'Selenium',
  'йод': 'Iodine', 'йод (мкг)': 'Iodine',
  'калий': 'Potassium', 'калий (mg)': 'Potassium', 'калий (мг)': 'Potassium',
  'натрий': 'Sodium', 'натрий (mg)': 'Sodium', 'натрий (мг)': 'Sodium',
  'фосфор': 'Phosphorus', 'фосфор (mg)': 'Phosphorus', 'фосфор (мг)': 'Phosphorus',
  'омега-3': 'Omega-3', 'омега 3': 'Omega-3',
};

export const normalizeMicronutrientKey = (rawKey: string): string => {
  const lowerKey = rawKey.toLowerCase().trim();
  if (MICRONUTRIENT_NAME_MAPPING[lowerKey]) return MICRONUTRIENT_NAME_MAPPING[lowerKey];
  return rawKey.split(' (')[0].trim();
};

export const UNIT_MAPPING: Record<string, string> = {
  'мг': 'mg', 'mg': 'mg',
  'мкг': 'mcg', 'mcg': 'mcg', 'mc': 'mcg',
  'г': 'g', 'g': 'g',
  'ме': 'iu', 'iu': 'iu',
  'ккал': 'kcal', 'kcal': 'kcal'
};

export const translateUnit = (unit: string, t: any): string => {
  const lower = unit.toLowerCase().trim();
  const canonical = UNIT_MAPPING[lower] || lower;
  return t.has(canonical) ? t(canonical) : unit;
};

export const translateValueWithUnit = (valStr: string, t: any): string => {
  if (!valStr) return valStr;
  // Regex to split number and unit (e.g. "15.0мкг" or "15.0 мкг")
  const match = valStr.match(/^([\d.]+)\s*(.*)$/);
  if (!match) return valStr;
  const [_, num, unit] = match;
  if (!unit) return num;
  return `${num}${translateUnit(unit, t)}`;
};
