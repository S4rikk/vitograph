"use client";

import { useLocale } from 'next-intl';
import { 
  IMPERIAL_LOCALES, 
  type UnitSystem,
  kgToLbs, lbsToKg,
  cmToFtIn, ftInToCm, formatFtIn,
  celsiusToFahrenheit, fahrenheitToCelsius,
  mmolToMgDl, mgDlToMmol
} from '@/lib/units';

export function useUnits() {
  const locale = useLocale();
  const system: UnitSystem = IMPERIAL_LOCALES.includes(locale) ? 'imperial' : 'metric';
  const isImperial = system === 'imperial';

  return {
    system,
    isImperial,
    
    // ── Display Methods (Metric from DB → User Format) ──
    displayWeight: (kg: number) => isImperial ? kgToLbs(kg) : kg,
    displayHeight: (cm: number) => isImperial ? formatFtIn(cmToFtIn(cm).feet, cmToFtIn(cm).inches) : `${cm}`,
    displayTemp: (c: number) => isImperial ? celsiusToFahrenheit(c) : c,
    displayGlucose: (mmol: number) => isImperial ? mmolToMgDl(mmol) : mmol,

    // ── Parse Methods (User Input → Metric for DB) ──
    parseWeight: (val: number) => isImperial ? lbsToKg(val) : val,
    parseHeightImperial: (feet: number, inches: number) => ftInToCm(feet, inches),
    parseTemp: (val: number) => isImperial ? fahrenheitToCelsius(val) : val,
    parseGlucose: (val: number) => isImperial ? mgDlToMmol(val) : val,

    // ── Unit Labels (Keys for i18n) ──
    // These match the keys in ru.json/en.json "units" namespace
    weightUnitKey: isImperial ? 'lbs' : 'kg',
    heightUnitKey: isImperial ? 'ftIn' : 'cm',
    tempUnitKey: isImperial ? 'fahrenheit' : 'celsius',
    glucoseUnitKey: isImperial ? 'mgDl' : 'mmolL',
  };
}
