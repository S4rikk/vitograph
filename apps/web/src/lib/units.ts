export type UnitSystem = 'metric' | 'imperial';

export const IMPERIAL_LOCALES = ['en'];

// ── Weight ──
export function kgToLbs(kg: number): number { 
  return +(kg * 2.20462).toFixed(1); 
}
export function lbsToKg(lbs: number): number { 
  return +(lbs / 2.20462).toFixed(1); 
}

// ── Height ──
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
}
export function ftInToCm(feet: number, inches: number): number {
  return +((feet * 12 + inches) * 2.54).toFixed(1);
}
export function formatFtIn(feet: number, inches: number): string {
  return `${feet}′${inches}″`;
}

// ── Temperature ──
export function celsiusToFahrenheit(c: number): number { 
  return +(c * 9/5 + 32).toFixed(1); 
}
export function fahrenheitToCelsius(f: number): number { 
  return +((f - 32) * 5/9).toFixed(1); 
}

// ── Glucose ──
export function mmolToMgDl(mmol: number): number { 
  return +(mmol * 18.0182).toFixed(0); 
}
export function mgDlToMmol(mgDl: number): number { 
  return +(mgDl / 18.0182).toFixed(1); 
}
