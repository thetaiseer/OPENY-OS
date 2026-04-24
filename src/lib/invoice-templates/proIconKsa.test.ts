import { describe, expect, it } from 'vitest';
import { generateProIconKsa } from './proIconKsa';
import {
  distributeWithVariance,
  generateCPAResults,
  generateDates,
  randomVariance,
} from './shared';

describe('Invoice template engine', () => {
  it('generates a valid Pro Icon KSA output shape', () => {
    const result = generateProIconKsa({
      totalBudget: 2500,
      month: '2025-08',
      currency: 'SAR',
      platforms: [
        { type: 'instagram', percentage: 50, campaignCount: 2 },
        { type: 'snapchat', percentage: 30, campaignCount: 1 },
        { type: 'tiktok', percentage: 20, campaignCount: 1 },
      ],
    });

    expect(result.fixedFee).toBe(500);
    expect(result.netBudget).toBe(2000);
    expect(result.branches).toHaveLength(3);
    expect(result.subtotal).toBeGreaterThanOrEqual(0);
    expect(result.tax).toBe(Number((result.subtotal * 0.15).toFixed(2)));
    expect(result.total).toBe(Number((result.subtotal + result.tax).toFixed(2)));
    expect(result.branches.every((branch) => branch.totalBudget >= 0)).toBe(true);
    expect(result.branches.flatMap((branch) => branch.platforms).length).toBeGreaterThan(0);
  });
});

describe('Invoice template shared helpers', () => {
  it('creates a stable variance around a base value', () => {
    expect(randomVariance(100, 10)).toBeGreaterThanOrEqual(90);
    expect(randomVariance(100, 10)).toBeLessThanOrEqual(110);
  });

  it('distributes totals across parts with small variation', () => {
    const values = distributeWithVariance(1000, 3);
    expect(values).toHaveLength(3);
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(1000);
  });

  it('generates first-half-of-month campaign dates', () => {
    const dates = generateDates('2025-09', 3);
    expect(dates).toHaveLength(3);
    expect(dates.every((date) => /^2025-09-\d{2}$/.test(date))).toBe(true);
  });

  it('calculates CPA results for all supported platforms', () => {
    expect(generateCPAResults(500, 'instagram')).toBeGreaterThanOrEqual(1);
    expect(generateCPAResults(500, 'snapchat')).toBeGreaterThanOrEqual(1);
    expect(generateCPAResults(500, 'tiktok')).toBeGreaterThanOrEqual(1);
    expect(generateCPAResults(500, 'google')).toBeGreaterThanOrEqual(1);
    expect(generateCPAResults(500, 'other')).toBeGreaterThanOrEqual(1);
  });
});
