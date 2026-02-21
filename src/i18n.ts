import type { Language } from './types';

export const labels = {
  appTitle: { en: 'CarbCycler Planner', zh: '碳循环计划器' },
  language: { en: 'Language', zh: '语言' },
  sex: { en: 'Sex', zh: '性别' },
  weight: { en: 'Weight (kg)', zh: '体重 (kg)' },
  bodyType: { en: 'Body Type', zh: '体型' },
  proteinPerKg: { en: 'Protein (g/kg)', zh: '蛋白 (g/kg)' },
  ectoFat: { en: 'Ecto Fat (g/kg)', zh: '外胚型脂肪 (g/kg)' },
  cycleDays: { en: 'Cycle Days', zh: '周期天数' },
  customDays: { en: 'Custom days', zh: '自定义天数' },
  shares: { en: 'Macro Shares', zh: '宏量分配' },
  dayCounts: { en: 'Day Counts', zh: '高中低碳天数' },
  dayPlacement: { en: 'Day-by-Day Placement', zh: '逐日类型排布' },
  targets: { en: 'Cycle Targets', zh: '周期目标' },
  planner: { en: 'Daily Meal Planner', zh: '每日饮食计划' },
  autoGenerate: { en: 'Auto-generate grams', zh: '自动生成克数' },
  addCustomFood: { en: 'Add Custom Food', zh: '添加自定义食物' },
  exportCsv: { en: 'Export CSV', zh: '导出 CSV' },
  exportXlsx: { en: 'Export XLSX', zh: '导出 XLSX' },
  dayPoster: { en: 'Export Day Poster', zh: '导出当日海报' },
  cyclePoster: { en: 'Export Cycle Poster', zh: '导出周期海报' },
  search: { en: 'Search foods', zh: '搜索食物' },
  categories: { en: 'Categories', zh: '分类' },
  deviation: { en: 'Deviation', zh: '偏差' },
  saveImage: { en: 'Save Image', zh: '保存图片' }
} as const;

export function t(lang: Language, key: keyof typeof labels): string {
  return labels[key][lang];
}
