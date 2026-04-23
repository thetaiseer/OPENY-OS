import type { PlatformType } from './types';

export function randomVariance(value: number, percent: number): number {
  const normalizedValue = Number.isFinite(value) ? value : 0;
  const normalizedPercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  if (normalizedPercent <= 0 || normalizedValue === 0) return normalizedValue;

  const seed = Math.abs(normalizedValue * 12.7 + normalizedPercent * 7.3);
  const pseudoRandom = Math.sin(seed) * 10000;
  const fraction = pseudoRandom - Math.floor(pseudoRandom);
  const variance = (fraction - 0.5) * 2 * normalizedPercent;

  return normalizedValue * (1 + variance / 100);
}

export function distributeWithVariance(total: number, parts: number): number[] {
  const safeTotal = Math.max(0, Math.round(total));
  const safeParts = Math.max(1, Math.round(parts));
  if (safeParts === 1) return [safeTotal];

  const base = safeTotal / safeParts;
  const distributed = Array.from({ length: safeParts }, (_, index) => {
    const offset = (index - (safeParts - 1) / 2) / Math.max(1, safeParts - 1);
    const value = randomVariance(base + offset * 0.5, 10);
    return Math.max(0, Math.round(value));
  });

  let remainder = safeTotal - distributed.reduce((sum, current) => sum + current, 0);
  let cursor = 0;
  while (remainder !== 0) {
    const index = cursor % safeParts;
    if (remainder > 0) {
      distributed[index] += 1;
      remainder -= 1;
    } else if (distributed[index] > 0) {
      distributed[index] -= 1;
      remainder += 1;
    }
    cursor += 1;
  }

  return distributed;
}

export function generateDates(month: string, count: number): string[] {
  const safeCount = Math.max(0, Math.round(count));
  if (safeCount === 0) return [];

  const segments = month.split('-').map((part) => Number(part));
  const year = Number.isFinite(segments[0]) ? segments[0] : new Date().getFullYear();
  const monthIndex = Number.isFinite(segments[1]) ? Math.min(Math.max(segments[1], 1), 12) : 1;

  const dates: string[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    const spread = safeCount === 1 ? 7 : Math.round((index * 14) / Math.max(1, safeCount - 1));
    const offset = index % 2 === 0 ? 1 : -1;
    const day = Math.min(15, Math.max(1, spread + 1 + offset));
    dates.push(`${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }

  return dates;
}

export function generateCPAResults(cost: number, platform: PlatformType): number {
  const normalizedCost = Number.isFinite(cost) ? Math.max(0, cost) : 0;
  if (normalizedCost <= 0) return 0;

  const platformRanges: Record<PlatformType, [number, number]> = {
    instagram: [20, 28],
    snapchat: [4, 8],
    tiktok: [5, 10],
    google: [12, 20],
    other: [8, 15],
  };

  const [minCpa, maxCpa] = platformRanges[platform] ?? platformRanges.other;
  const averageCpa = (minCpa + maxCpa) / 2;
  const cpa = Math.max(1, randomVariance(averageCpa, 12));
  return Math.max(1, Math.round(normalizedCost / cpa));
}
