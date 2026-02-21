import { useEffect, useMemo, useRef, useState } from 'react';
import type { Basis, Category, DayFoodEntry, DayTarget, DayType, FoodItem, Language, PlannerProfile } from './types';
import { DEFAULT_CARB_SHARES, DEFAULT_FAT_SHARES, calculateCycle, normalizePlacement, validateProfile } from './utils/calc';
import { exportCsv, exportXlsx } from './utils/export';
import { computeTotals, greedyGenerate } from './utils/solver';
import { idbGet, idbSet } from './utils/storage';
import { SegmentedTabs, type MainTab } from './components/SegmentedTabs';
import { ProfileTab } from './components/ProfileTab';
import { PlanTab } from './components/PlanTab';
import { FoodsTab } from './components/FoodsTab';
import { MacroDeltaBar } from './components/MacroDeltaBar';

const STORAGE_KEYS = {
  profile: 'cc_profile_v2',
  plans: 'cc_day_plans_v2',
  customFoods: 'cc_custom_foods_v2',
  lang: 'cc_lang_v2'
} as const;

const categories: Array<{ key: Category | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'protein', label: 'Protein' },
  { key: 'carb', label: 'Carb' },
  { key: 'fat', label: 'Fat' },
  { key: 'veg', label: 'Veg' },
  { key: 'fruit', label: 'Fruit' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'other', label: 'Other' }
];

const defaultProfile: PlannerProfile = {
  sex: 'Female',
  weightKg: 70,
  bodyType: 'endo',
  proteinPerKg: 1.2,
  ectoFatPerKg: 1.0,
  cycleDays: 5,
  nHigh: 2,
  nMed: 2,
  nLow: 1,
  carbShares: { ...DEFAULT_CARB_SHARES },
  fatShares: { ...DEFAULT_FAT_SHARES },
  dayPlacement: ['High', 'High', 'Medium', 'Medium', 'Low']
};

type FoodDb = { version: number; units: string; foods: FoodItem[] };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function downloadDataUrl(name: string, dataUrl: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('profile');
  const [lang, setLang] = useState<Language>('en');
  const [profile, setProfile] = useState<PlannerProfile>(defaultProfile);
  const [dayPlans, setDayPlans] = useState<Record<number, DayFoodEntry[]>>({});
  const [builtins, setBuiltins] = useState<FoodItem[]>([]);
  const [customFoods, setCustomFoods] = useState<FoodItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [toast, setToast] = useState('');

  const dayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cycleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [customForm, setCustomForm] = useState({
    name_en: '',
    name_zh: '',
    category: 'other' as Category,
    basis: 'raw' as Basis,
    p: 0,
    c: 0,
    f: 0,
    kcal: 0
  });

  useEffect(() => {
    (async () => {
      const [savedLang, savedProfile, savedPlans, savedCustom] = await Promise.all([
        idbGet<Language>(STORAGE_KEYS.lang, 'en'),
        idbGet<PlannerProfile>(STORAGE_KEYS.profile, defaultProfile),
        idbGet<Record<number, DayFoodEntry[]>>(STORAGE_KEYS.plans, {}),
        idbGet<FoodItem[]>(STORAGE_KEYS.customFoods, [])
      ]);

      const normalized = { ...savedProfile, dayPlacement: normalizePlacement(savedProfile) };
      setLang(savedLang);
      setProfile(normalized);
      setDayPlans(savedPlans);
      setCustomFoods(savedCustom);
    })();
  }, []);

  useEffect(() => {
    fetch('/foods.json')
      .then((r) => r.json())
      .then((d: FoodDb) => setBuiltins(d.foods || []))
      .catch(() => setBuiltins([]));
  }, []);

  useEffect(() => {
    idbSet(STORAGE_KEYS.lang, lang);
  }, [lang]);

  useEffect(() => {
    idbSet(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    idbSet(STORAGE_KEYS.plans, dayPlans);
  }, [dayPlans]);

  useEffect(() => {
    idbSet(STORAGE_KEYS.customFoods, customFoods);
  }, [customFoods]);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(h);
  }, [toast]);

  const allFoods = useMemo(() => [...builtins, ...customFoods], [builtins, customFoods]);
  const foodsMap = useMemo(() => new Map(allFoods.map((f) => [f.id, f])), [allFoods]);

  const cycle = useMemo(() => calculateCycle(profile), [profile]);
  const validationErrors = useMemo(() => validateProfile(profile), [profile]);

  const currentDayTarget: DayTarget | undefined = cycle.dayTargets[selectedDay - 1];
  const currentEntries: DayFoodEntry[] = dayPlans[selectedDay] ?? [];
  const currentTotals = useMemo(() => computeTotals(currentEntries, foodsMap), [currentEntries, foodsMap]);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFoods.filter((f) => {
      if (category !== 'all' && f.category !== category) return false;
      if (!q) return true;
      return f.name_en.toLowerCase().includes(q) || f.name_zh.toLowerCase().includes(q);
    });
  }, [allFoods, search, category]);

  const deviationsByDay = useMemo(() => {
    return cycle.dayTargets.map((target) => {
      const totals = computeTotals(dayPlans[target.day] ?? [], foodsMap);
      return {
        day: target.day,
        dayType: target.dayType,
        target,
        totals,
        dp: Number((totals.p - target.proteinTarget).toFixed(2)),
        dc: Number((totals.c - target.carbTarget).toFixed(2)),
        df: Number((totals.f - target.fatTarget).toFixed(2))
      };
    });
  }, [cycle.dayTargets, dayPlans, foodsMap]);

  function patchProfile<K extends keyof PlannerProfile>(key: K, value: PlannerProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function setCycleDays(nextDays: number) {
    setProfile((p) => {
      const cycleDays = clamp(nextDays, 1, 30);
      let nHigh = Math.min(p.nHigh, cycleDays);
      let nMed = Math.min(p.nMed, cycleDays - nHigh);
      let nLow = cycleDays - nHigh - nMed;
      if (nLow < 0) nLow = 0;
      const dayPlacement: DayType[] = [];
      for (let i = 0; i < nHigh; i++) dayPlacement.push('High');
      for (let i = 0; i < nMed; i++) dayPlacement.push('Medium');
      for (let i = 0; i < nLow; i++) dayPlacement.push('Low');
      return { ...p, cycleDays, nHigh, nMed, nLow, dayPlacement };
    });
    setSelectedDay(1);
  }

  function setCounts(nHigh: number, nMed: number, nLow: number) {
    const cycleDays = profile.cycleDays;
    if (nHigh + nMed + nLow !== cycleDays) {
      setProfile((p) => ({ ...p, nHigh, nMed, nLow }));
      return;
    }
    const dayPlacement: DayType[] = [];
    for (let i = 0; i < nHigh; i++) dayPlacement.push('High');
    for (let i = 0; i < nMed; i++) dayPlacement.push('Medium');
    for (let i = 0; i < nLow; i++) dayPlacement.push('Low');
    setProfile((p) => ({ ...p, nHigh, nMed, nLow, dayPlacement }));
  }

  function setPlacement(dayIndex: number, dayType: DayType) {
    setProfile((p) => {
      const next = [...p.dayPlacement];
      next[dayIndex] = dayType;
      return { ...p, dayPlacement: next };
    });
  }

  function setCarbShare(dayType: DayType, value: number) {
    setProfile((p) => ({ ...p, carbShares: { ...p.carbShares, [dayType]: value } }));
  }

  function setFatShare(dayType: DayType, value: number) {
    setProfile((p) => ({ ...p, fatShares: { ...p.fatShares, [dayType]: value } }));
  }

  function toggleFood(foodId: string) {
    setDayPlans((plans) => {
      const entries = [...(plans[selectedDay] ?? [])];
      const idx = entries.findIndex((e) => e.foodId === foodId);
      if (idx >= 0) {
        entries.splice(idx, 1);
      } else {
        const food = foodsMap.get(foodId);
        entries.push({
          foodId,
          basis: food?.variants[0]?.basis ?? 'raw',
          grams: 0
        });
      }
      return { ...plans, [selectedDay]: entries };
    });
  }

  function patchEntry(foodId: string, patch: Partial<DayFoodEntry>) {
    setDayPlans((plans) => {
      const entries = [...(plans[selectedDay] ?? [])];
      const idx = entries.findIndex((e) => e.foodId === foodId);
      if (idx < 0) return plans;
      entries[idx] = { ...entries[idx], ...patch };
      return { ...plans, [selectedDay]: entries };
    });
  }

  function handleAutoGenerate() {
    if (!currentDayTarget) return;
    const generated = greedyGenerate(currentEntries, foodsMap, {
      p: currentDayTarget.proteinTarget,
      c: currentDayTarget.carbTarget,
      f: currentDayTarget.fatTarget
    });
    setDayPlans((plans) => ({ ...plans, [selectedDay]: generated }));
    setToast(lang === 'en' ? 'Auto-generated.' : '已自动生成。');
  }

  function addCustomFood() {
    const nameEn = customForm.name_en.trim();
    const nameZh = customForm.name_zh.trim() || nameEn;
    if (!nameEn) {
      setToast(lang === 'en' ? 'Custom food name required.' : '请填写食物名称。');
      return;
    }
    const id = `custom_${Date.now()}`;
    const food: FoodItem = {
      id,
      name_en: nameEn,
      name_zh: nameZh,
      category: customForm.category,
      emoji: ' ',
      variants: [
        {
          basis: customForm.basis,
          kcal: customForm.kcal,
          p: customForm.p,
          c: customForm.c,
          f: customForm.f
        }
      ]
    };
    setCustomFoods((f) => [food, ...f]);
    setCustomForm({
      name_en: '',
      name_zh: '',
      category: 'other',
      basis: 'raw',
      p: 0,
      c: 0,
      f: 0,
      kcal: 0
    });
    setToast(lang === 'en' ? 'Custom food saved.' : '已保存自定义食物。');
  }

  function exportCycleCsv() {
    const rows = cycle.dayTargets.map((d) => [d.day, d.dayType, d.proteinTarget, d.carbTarget, d.fatTarget]);
    exportCsv('cycle_targets.csv', ['day', 'day_type', 'protein_target_g', 'carb_target_g', 'fat_target_g'], rows);
  }

  function exportAllXlsx() {
    exportXlsx(cycle.dayTargets, dayPlans, foodsMap);
  }

  function renderPoster(kind: 'day' | 'cycle') {
    const canvas = kind === 'day' ? dayCanvasRef.current : cycleCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = kind === 'day' ? 1400 : 1800;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 48px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(kind === 'day' ? `Day ${selectedDay} Plan` : 'Cycle Summary', 60, 90);

    ctx.font = '400 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillStyle = '#334155';

    let y = 160;
    if (kind === 'day' && currentDayTarget) {
      ctx.fillText(`Type: ${currentDayTarget.dayType}`, 60, y);
      y += 44;
      ctx.fillText(`Targets P/C/F: ${currentDayTarget.proteinTarget} / ${currentDayTarget.carbTarget} / ${currentDayTarget.fatTarget} g`, 60, y);
      y += 44;
      ctx.fillText(`Actual P/C/F: ${currentTotals.p} / ${currentTotals.c} / ${currentTotals.f} g`, 60, y);
      y += 44;
      ctx.fillText(`Deviation: ${(currentTotals.p - currentDayTarget.proteinTarget).toFixed(1)} / ${(currentTotals.c - currentDayTarget.carbTarget).toFixed(1)} / ${(currentTotals.f - currentDayTarget.fatTarget).toFixed(1)} g`, 60, y);
      y += 70;
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 32px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Foods', 60, y);
      y += 42;
      ctx.font = '400 26px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillStyle = '#334155';
      currentEntries.forEach((e) => {
        const food = foodsMap.get(e.foodId);
        const name = lang === 'zh' ? food?.name_zh : food?.name_en;
        const v = food?.variants.find((x) => x.basis === e.basis) ?? food?.variants[0];
        const ratio = e.grams / 100;
        const p = ((v?.p ?? 0) * ratio).toFixed(1);
        const c = ((v?.c ?? 0) * ratio).toFixed(1);
        const f = ((v?.f ?? 0) * ratio).toFixed(1);
        ctx.fillText(`${name} (${e.basis}) ${e.grams.toFixed(1)}g  P/C/F ${p}/${c}/${f}`, 60, y);
        y += 36;
      });
    } else {
      ctx.fillText(`Weight: ${profile.weightKg} kg, Body: ${profile.bodyType}`, 60, y);
      y += 44;
      ctx.fillText(`Cycle Days: ${profile.cycleDays}`, 60, y);
      y += 44;
      ctx.fillText(`P_day=${cycle.pDay}g  C_total=${cycle.cTotal}g  F_total=${cycle.fTotal}g`, 60, y);
      y += 60;
      ctx.fillStyle = '#0f172a';
      ctx.font = '600 32px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Day Targets & Deviations', 60, y);
      y += 42;
      ctx.fillStyle = '#334155';
      ctx.font = '400 24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      deviationsByDay.forEach((d) => {
        ctx.fillText(
          `D${d.day} ${d.dayType} T(${d.target.proteinTarget}/${d.target.carbTarget}/${d.target.fatTarget}) A(${d.totals.p}/${d.totals.c}/${d.totals.f}) Δ(${d.dp}/${d.dc}/${d.df})`,
          60,
          y
        );
        y += 34;
      });
    }

    const url = canvas.toDataURL('image/png');
    downloadDataUrl(kind === 'day' ? `day_${selectedDay}_poster.png` : 'cycle_summary_poster.png', url);
    setToast(lang === 'en' ? 'Image exported.' : '图片已导出。');
  }

  const cycleOptions = [3, 4, 5, 7];

  const proteinRemaining = currentDayTarget ? currentDayTarget.proteinTarget - currentTotals.p : 0;
  const carbRemaining = currentDayTarget ? currentDayTarget.carbTarget - currentTotals.c : 0;
  const fatRemaining = currentDayTarget ? currentDayTarget.fatTarget - currentTotals.f : 0;

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="app-title">CarbCycler</h1>
        <div className="row">
          <label className="small">Language</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as Language)}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </header>

      <SegmentedTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === 'profile' && (
        <ProfileTab
          lang={lang}
          profile={profile}
          cycleOptions={cycleOptions}
          patchProfile={patchProfile}
          setCycleDays={setCycleDays}
        />
      )}

      {activeTab === 'plan' && (
        <PlanTab
          profile={profile}
          cycle={cycle}
          errors={validationErrors}
          deviations={deviationsByDay}
          setCounts={setCounts}
          setPlacement={setPlacement}
          setCarbShare={setCarbShare}
          setFatShare={setFatShare}
          onExportCsv={exportCycleCsv}
          onExportXlsx={exportAllXlsx}
          onExportPoster={() => renderPoster('cycle')}
        />
      )}

      {activeTab === 'foods' && (
        <FoodsTab
          lang={lang}
          selectedDay={selectedDay}
          dayTargets={cycle.dayTargets}
          currentDayTarget={currentDayTarget}
          currentEntries={currentEntries}
          currentTotals={currentTotals}
          validationErrors={validationErrors}
          search={search}
          category={category}
          categories={categories}
          filteredFoods={filteredFoods}
          foodsMap={foodsMap}
          customForm={customForm}
          onSetSelectedDay={setSelectedDay}
          onSearch={setSearch}
          onCategory={setCategory}
          onToggleFood={toggleFood}
          onPatchEntry={patchEntry}
          onAutoGenerate={handleAutoGenerate}
          onExportDayPoster={() => renderPoster('day')}
          onSetCustomForm={(patch) => setCustomForm((f) => ({ ...f, ...patch }))}
          onAddCustomFood={addCustomFood}
        />
      )}

      {activeTab === 'foods' && (
        <MacroDeltaBar
          proteinRemaining={proteinRemaining}
          carbRemaining={carbRemaining}
          fatRemaining={fatRemaining}
        />
      )}

      <canvas ref={dayCanvasRef} style={{ display: 'none' }} />
      <canvas ref={cycleCanvasRef} style={{ display: 'none' }} />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
