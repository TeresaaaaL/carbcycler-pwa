export type Language = 'en' | 'zh';

export type BodyType = 'endo' | 'ecto';

export type DayType = 'High' | 'Medium' | 'Low';

export type Basis = 'raw' | 'cooked' | 'fresh';

export type Category = 'protein' | 'carb' | 'fat' | 'veg' | 'fruit' | 'dairy' | 'other';

export interface FoodVariant {
  basis: Basis;
  kcal?: number;
  p: number;
  c: number;
  f: number;
}

export interface FoodItem {
  id: string;
  name_en: string;
  name_zh: string;
  category: Category;
  emoji: string;
  variants: FoodVariant[];
}

export interface PlannerProfile {
  sex: string;
  weightKg: number;
  bodyType: BodyType;
  proteinPerKg: number;
  ectoFatPerKg: number;
  cycleDays: number;
  nHigh: number;
  nMed: number;
  nLow: number;
  carbShares: Record<DayType, number>;
  fatShares: Record<DayType, number>;
  dayPlacement: DayType[];
}

export interface DayTarget {
  day: number;
  dayType: DayType;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
}

export interface DayFoodEntry {
  foodId: string;
  basis: Basis;
  grams: number;
}

export interface DayTotals {
  kcal: number;
  p: number;
  c: number;
  f: number;
}
