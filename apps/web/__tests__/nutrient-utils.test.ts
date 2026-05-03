import { translateUnit, translateValueWithUnit } from '../src/lib/food-diary/nutrient-utils';

const mockT = (key: string) => {
  const translations: Record<string, string> = { mg: 'мг', g: 'г', kcal: 'ккал' };
  return translations[key] || key;
};
mockT.has = (key: string) => ['mg', 'g', 'kcal'].includes(key);

describe('nutrient-utils', () => {
  describe('translateUnit', () => {
    it('should correctly translate known units', () => {
      expect(translateUnit('mg', mockT)).toBe('мг');
      expect(translateUnit('g', mockT)).toBe('г');
      expect(translateUnit('kcal', mockT)).toBe('ккал');
    });

    it('should return original unit if unknown', () => {
      expect(translateUnit('unknown', mockT)).toBe('unknown');
    });
  });

  describe('translateValueWithUnit', () => {
    it('should format value and translated unit', () => {
      expect(translateValueWithUnit('10.5 mg', mockT)).toBe('10.5мг');
    });
  });
});
