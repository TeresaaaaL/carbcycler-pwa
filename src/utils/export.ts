import * as XLSX from 'xlsx';
import type { DayFoodEntry, DayTarget, FoodItem } from '../types';
import { computeTotals } from './solver';

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => JSON.stringify(v ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportXlsx(
  dayTargets: DayTarget[],
  dayPlans: Record<number, DayFoodEntry[]>,
  foodsMap: Map<string, FoodItem>
) {
  const targetRows = dayTargets.map((d) => ({
    day: d.day,
    day_type: d.dayType,
    protein_target_g: d.proteinTarget,
    carb_target_g: d.carbTarget,
    fat_target_g: d.fatTarget
  }));

  const planRows: Array<Record<string, string | number>> = [];
  const devRows: Array<Record<string, string | number>> = [];

  dayTargets.forEach((target) => {
    const entries = dayPlans[target.day] ?? [];
    const totals = computeTotals(entries, foodsMap);

    entries.forEach((e) => {
      const food = foodsMap.get(e.foodId);
      const variant = food?.variants.find((v) => v.basis === e.basis) ?? food?.variants[0];
      const ratio = e.grams / 100;
      planRows.push({
        day: target.day,
        food_id: e.foodId,
        food_name: food?.name_en ?? e.foodId,
        basis: e.basis,
        grams: e.grams,
        protein_g: Number(((variant?.p ?? 0) * ratio).toFixed(2)),
        carb_g: Number(((variant?.c ?? 0) * ratio).toFixed(2)),
        fat_g: Number(((variant?.f ?? 0) * ratio).toFixed(2)),
        kcal: Number((((variant?.kcal ?? 0) * ratio)).toFixed(2))
      });
    });

    devRows.push({
      day: target.day,
      day_type: target.dayType,
      protein_target_g: target.proteinTarget,
      protein_actual_g: totals.p,
      protein_diff_g: Number((totals.p - target.proteinTarget).toFixed(2)),
      carb_target_g: target.carbTarget,
      carb_actual_g: totals.c,
      carb_diff_g: Number((totals.c - target.carbTarget).toFixed(2)),
      fat_target_g: target.fatTarget,
      fat_actual_g: totals.f,
      fat_diff_g: Number((totals.f - target.fatTarget).toFixed(2)),
      kcal_actual: totals.kcal
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(targetRows), 'CycleTargets');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planRows), 'DailyPlan');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(devRows), 'Deviations');
  XLSX.writeFile(wb, 'carbcycler_export.xlsx');
}
