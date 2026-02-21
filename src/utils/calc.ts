import type { DayTarget, DayType, PlannerProfile } from '../types';

export const DEFAULT_CARB_SHARES: Record<DayType, number> = {
  High: 0.5,
  Medium: 0.35,
  Low: 0.15
};

export const DEFAULT_FAT_SHARES: Record<DayType, number> = {
  High: 0.15,
  Medium: 0.35,
  Low: 0.5
};

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizePlacement(profile: PlannerProfile): DayType[] {
  const required: Record<DayType, number> = {
    High: profile.nHigh,
    Medium: profile.nMed,
    Low: profile.nLow
  };
  const out = [...profile.dayPlacement].slice(0, profile.cycleDays);
  while (out.length < profile.cycleDays) out.push('Low');

  const count = (arr: DayType[]) => ({
    High: arr.filter((d) => d === 'High').length,
    Medium: arr.filter((d) => d === 'Medium').length,
    Low: arr.filter((d) => d === 'Low').length
  });

  const current = count(out);
  const extras: Record<DayType, number> = {
    High: Math.max(0, current.High - required.High),
    Medium: Math.max(0, current.Medium - required.Medium),
    Low: Math.max(0, current.Low - required.Low)
  };
  const lacks: Record<DayType, number> = {
    High: Math.max(0, required.High - current.High),
    Medium: Math.max(0, required.Medium - current.Medium),
    Low: Math.max(0, required.Low - current.Low)
  };

  for (let i = out.length - 1; i >= 0; i -= 1) {
    const d = out[i];
    if (extras[d] <= 0) continue;
    const target = (['High', 'Medium', 'Low'] as DayType[]).find((k) => lacks[k] > 0);
    if (!target) continue;
    out[i] = target;
    extras[d] -= 1;
    lacks[target] -= 1;
  }
  return out;
}

export function validateProfile(profile: PlannerProfile): string[] {
  const errors: string[] = [];
  if (profile.nHigh + profile.nMed + profile.nLow !== profile.cycleDays) {
    errors.push('Day counts must sum to cycle days.');
  }
  const carbShareSum = profile.carbShares.High + profile.carbShares.Medium + profile.carbShares.Low;
  const fatShareSum = profile.fatShares.High + profile.fatShares.Medium + profile.fatShares.Low;
  if (Math.abs(carbShareSum - 1) > 1e-6) errors.push('Carb shares must sum to 1.0.');
  if (Math.abs(fatShareSum - 1) > 1e-6) errors.push('Fat shares must sum to 1.0.');
  const pCounts = {
    High: profile.dayPlacement.filter((d) => d === 'High').length,
    Medium: profile.dayPlacement.filter((d) => d === 'Medium').length,
    Low: profile.dayPlacement.filter((d) => d === 'Low').length
  };
  if (pCounts.High !== profile.nHigh || pCounts.Medium !== profile.nMed || pCounts.Low !== profile.nLow) {
    errors.push('Day placement must keep fixed counts for High/Medium/Low.');
  }
  return errors;
}

export function calculateCycle(profile: PlannerProfile): {
  dayTargets: DayTarget[];
  pDay: number;
  cTotal: number;
  fTotal: number;
} {
  const carbPerKg = profile.bodyType === 'endo' ? 2.0 : 3.0;
  const fatPerKg = profile.bodyType === 'endo' ? 0.8 : profile.ectoFatPerKg;

  const pDay = profile.weightKg * profile.proteinPerKg;
  const cTotal = profile.weightKg * carbPerKg * profile.cycleDays;
  const fTotal = profile.weightKg * fatPerKg * profile.cycleDays;

  const perTypeC: Record<DayType, number> = {
    High: profile.nHigh > 0 ? (cTotal * profile.carbShares.High) / profile.nHigh : 0,
    Medium: profile.nMed > 0 ? (cTotal * profile.carbShares.Medium) / profile.nMed : 0,
    Low: profile.nLow > 0 ? (cTotal * profile.carbShares.Low) / profile.nLow : 0
  };

  const perTypeF: Record<DayType, number> = {
    High: profile.nHigh > 0 ? (fTotal * profile.fatShares.High) / profile.nHigh : 0,
    Medium: profile.nMed > 0 ? (fTotal * profile.fatShares.Medium) / profile.nMed : 0,
    Low: profile.nLow > 0 ? (fTotal * profile.fatShares.Low) / profile.nLow : 0
  };

  const dayTargets: DayTarget[] = profile.dayPlacement.map((dayType, idx) => ({
    day: idx + 1,
    dayType,
    proteinTarget: round2(pDay),
    carbTarget: round2(perTypeC[dayType]),
    fatTarget: round2(perTypeF[dayType])
  }));

  return { dayTargets, pDay: round2(pDay), cTotal: round2(cTotal), fTotal: round2(fTotal) };
}
