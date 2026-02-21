import type { Basis, DayFoodEntry, DayTotals, FoodItem } from '../types';
import { round2 } from './calc';

function getVariant(food: FoodItem, basis: Basis) {
  return food.variants.find((v) => v.basis === basis) ?? food.variants[0];
}

export function computeTotals(entries: DayFoodEntry[], foodsMap: Map<string, FoodItem>): DayTotals {
  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  for (const e of entries) {
    const food = foodsMap.get(e.foodId);
    if (!food) continue;
    const v = getVariant(food, e.basis);
    const ratio = Math.max(0, e.grams) / 100;
    kcal += (v.kcal ?? 0) * ratio;
    p += v.p * ratio;
    c += v.c * ratio;
    f += v.f * ratio;
  }
  return { kcal: round2(kcal), p: round2(p), c: round2(c), f: round2(f) };
}

function score(target: { p: number; c: number; f: number }, totals: DayTotals): number {
  return Math.abs(target.p - totals.p) + Math.abs(target.c - totals.c) + Math.abs(target.f - totals.f);
}

export function greedyGenerate(
  selected: DayFoodEntry[],
  foodsMap: Map<string, FoodItem>,
  target: { p: number; c: number; f: number }
): DayFoodEntry[] {
  const entries = selected.map((e) => ({ ...e, grams: Math.max(0, e.grams || 0) }));
  const proteins = entries.filter((e) => {
    const food = foodsMap.get(e.foodId);
    return food?.category === 'protein';
  });
  const carbs = entries.filter((e) => {
    const food = foodsMap.get(e.foodId);
    return food?.category === 'carb';
  });
  const fats = entries.filter((e) => {
    const food = foodsMap.get(e.foodId);
    return food?.category === 'fat';
  });

  const assign = (group: DayFoodEntry[], macro: 'p' | 'c' | 'f', needed: number) => {
    if (!group.length || needed <= 0) return;
    const sorted = [...group]
      .map((e) => {
        const food = foodsMap.get(e.foodId)!;
        const v = getVariant(food, e.basis);
        return { e, density: v[macro] };
      })
      .filter((x) => x.density > 0)
      .sort((a, b) => b.density - a.density);

    let remaining = needed;
    for (const item of sorted) {
      if (remaining <= 0) break;
      const grams = Math.max(0, (remaining / item.density) * 100);
      item.e.grams += grams;
      remaining -= item.density * (grams / 100);
    }
  };

  assign(proteins, 'p', target.p * 0.7);
  assign(carbs, 'c', target.c * 0.7);
  assign(fats, 'f', target.f * 0.7);

  const step = 5;
  for (let i = 0; i < 1500; i += 1) {
    const baseTotals = computeTotals(entries, foodsMap);
    const baseScore = score(target, baseTotals);
    if (baseScore < 1) break;

    let bestScore = baseScore;
    let bestIdx = -1;
    let bestDelta = 0;

    for (let idx = 0; idx < entries.length; idx += 1) {
      for (const delta of [step, -step]) {
        if (entries[idx].grams + delta < 0) continue;
        const original = entries[idx].grams;
        entries[idx].grams += delta;
        const s = score(target, computeTotals(entries, foodsMap));
        entries[idx].grams = original;
        if (s < bestScore - 1e-9) {
          bestScore = s;
          bestIdx = idx;
          bestDelta = delta;
        }
      }
    }

    if (bestIdx < 0) break;
    entries[bestIdx].grams = Math.max(0, entries[bestIdx].grams + bestDelta);
  }

  return entries.map((e) => ({ ...e, grams: round2(e.grams) }));
}
