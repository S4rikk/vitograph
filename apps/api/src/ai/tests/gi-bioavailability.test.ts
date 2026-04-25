import { describe, it, expect } from "vitest";
import { applyGiBioavailability } from "../src/lib/gi-bioavailability.js";

describe("applyGiBioavailability", () => {
  
  // ── Edge Cases ──
  
  it("should return raw values unchanged when GI is null", () => {
    const raw = { "Магний (мг)": 100, "Калий (мг)": 200 };
    const { adjusted, appliedGi } = applyGiBioavailability(raw, null);
    expect(adjusted).toEqual(raw);
    expect(appliedGi).toBeNull();
  });

  it("should return raw values unchanged when GI is undefined", () => {
    const raw = { "Витамин C (мг)": 50 };
    const { adjusted } = applyGiBioavailability(raw, undefined);
    expect(adjusted).toEqual(raw);
  });

  it("should return raw values unchanged when GI is 0", () => {
    const raw = { "Железо (мг)": 10 };
    const { adjusted } = applyGiBioavailability(raw, 0);
    expect(adjusted).toEqual(raw);
  });

  it("should handle empty micros object", () => {
    const { adjusted } = applyGiBioavailability({}, 50);
    expect(adjusted).toEqual({});
  });

  // ── Reference Example (from the specification: GI = 88) ──
  
  it("should correctly apply coefficients for GI=88 (from spec)", () => {
    const raw = {
      "Магний (мг)": 16.0,      // Group 1 → coeff 0.15
      "Калий (мг)": 190.0,       // Group 2 → coeff 0.35
      "Витамин A (мкг)": 80.0,   // Group 3 → coeff 0.75
      "Железо (мг)": 1.4,        // Group 4 → coeff 0.50
    };
    
    const { adjusted, appliedGi } = applyGiBioavailability(raw, 88);
    
    expect(appliedGi).toBe(88);
    expect(adjusted["Магний (мг)"]).toBeCloseTo(2.4, 1);     // 16 * 0.15
    expect(adjusted["Калий (мг)"]).toBeCloseTo(66.5, 1);     // 190 * 0.35
    expect(adjusted["Витамин A (мкг)"]).toBeCloseTo(60.0, 1); // 80 * 0.75
    expect(adjusted["Железо (мг)"]).toBeCloseTo(0.7, 1);      // 1.4 * 0.50
  });

  // ── Low GI (should be gentle) ──
  
  it("should apply minimal reduction for very low GI (GI=10, range 0-15)", () => {
    const raw = { "Магний (мг)": 100, "Витамин C (мг)": 50 };
    const { adjusted } = applyGiBioavailability(raw, 10);
    expect(adjusted["Магний (мг)"]).toBe(100);    // 100 * 1.0
    expect(adjusted["Витамин C (мг)"]).toBe(50);  // 50 * 1.0
  });

  it("should apply moderate reduction for mid GI (GI=50, range 45-60)", () => {
    const raw = { "Магний (мг)": 100 };
    const { adjusted } = applyGiBioavailability(raw, 50);
    expect(adjusted["Магний (мг)"]).toBe(50);  // 100 * 0.50
  });

  // ── Unknown nutrients → no adjustment ──
  
  it("should NOT adjust nutrients not in any group (Натрий, Фосфор, Омега-3)", () => {
    const raw = {
      "Натрий (мг)": 500,
      "Фосфор (мг)": 200,
      "Омега-3 (мг)": 100,
      "Фолиевая кислота (мкг)": 400,
    };
    const { adjusted } = applyGiBioavailability(raw, 88);
    expect(adjusted["Натрий (мг)"]).toBe(500);
    expect(adjusted["Фосфор (мг)"]).toBe(200);
    expect(adjusted["Омега-3 (мг)"]).toBe(100);
    expect(adjusted["Фолиевая кислота (мкг)"]).toBe(400);
  });

  // ── Extreme GI (>100) ──
  
  it("should apply harshest coefficients for GI > 100", () => {
    const raw = { "Магний (мг)": 100, "Калий (мг)": 100 };
    const { adjusted } = applyGiBioavailability(raw, 110);
    expect(adjusted["Магний (мг)"]).toBeCloseTo(5, 1);    // 100 * 0.05
    expect(adjusted["Калий (мг)"]).toBeCloseTo(20, 1);    // 100 * 0.20
  });

  // ── Group 3 (Neutral) should remain relatively stable ──
  
  it("should only slightly reduce Group 3 even at high GI", () => {
    const raw = { "Витамин D (мкг)": 10, "Витамин B12 (мкг)": 2.4 };
    const { adjusted } = applyGiBioavailability(raw, 75);
    expect(adjusted["Витамин D (мкг)"]).toBeCloseTo(8.5, 1);    // 10 * 0.85
    expect(adjusted["Витамин B12 (мкг)"]).toBeCloseTo(2.0, 1);  // 2.4 * 0.85
  });
  
  // ── Boundary Tests ──

  it("should use correct range at boundary GI=15 (should be range index 0, coeff 1.0 for Group 1)", () => {
    const raw = { "Магний (мг)": 100 };
    const { adjusted } = applyGiBioavailability(raw, 15);
    // GI=15 → <=15 → index 0 (0-15 range) → Group 1 coeff = 1.0
    expect(adjusted["Магний (мг)"]).toBe(100);
  });

  it("should use correct range at boundary GI=100 (should be range index 5, 80-100)", () => {
    const raw = { "Магний (мг)": 100 };
    const { adjusted } = applyGiBioavailability(raw, 100);
    // GI=100 → <=100 → index 5 (80-100 range) → Group 1 coeff = 0.15
    expect(adjusted["Магний (мг)"]).toBeCloseTo(15, 1);
  });

  it("should use >100 range for GI=101", () => {
    const raw = { "Магний (мг)": 100 };
    const { adjusted } = applyGiBioavailability(raw, 101);
    // GI=101 → >100 → index 6 → Group 1 coeff = 0.05
    expect(adjusted["Магний (мг)"]).toBeCloseTo(5, 1);
  });
});
