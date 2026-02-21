import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from './i18n';
import type { Basis, Category, DayFoodEntry, DayTarget, DayType, FoodItem, Language, PlannerProfile } from './types';
import { DEFAULT_CARB_SHARES, DEFAULT_FAT_SHARES, calculateCycle, normalizePlacement, validateProfile } from './utils/calc';
import { exportCsv, exportXlsx } from './utils/export';
import { computeTotals, greedyGenerate } from './utils/solver';
import { idbGet, idbSet } from './utils/storage';

const STORAGE_KEYS = {
  profile: 'cc_profile_v2',
  plans: 'cc_day_plans_v2',
  customFoods: 'cc_custom_foods_v2',
  lang: 'cc_lang_v2'
} as const;

const categories: Array<{ key: Category | 'all'; emoji: string }> = [
  { key: 'all', emoji: '✨' },
  { key: 'protein', emoji: '🍗' },
  { key: 'carb', emoji: '🍚' },
  { key: 'fat', emoji: '🥑' },
  { key: 'veg', emoji: '🥦' },
  { key: 'fruit', emoji: '🍌' },
  { key: 'dairy', emoji: '🥛' },
  { key: 'other', emoji: '🍽️' }
];

const dayTypes: DayType[] = ['High', 'Medium', 'Low'];

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
      emoji: categories.find((c) => c.key === customForm.category)?.emoji ?? '🍽️',
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
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(kind === 'day' ? `Day ${selectedDay} Plan` : 'Cycle Summary', 60, 90);

    ctx.font = '28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillStyle = '#334155';

    let y = 160;
    if (kind === 'day' && currentDayTarget) {
      ctx.fillText(`Type: ${currentDayTarget.dayType}`, 60, y);
      y += 44;
      ctx.fillText(`Targets P/C/F: ${currentDayTarget.proteinTarget} / ${currentDayTarget.carbTarget} / ${currentDayTarget.fatTarget} g`, 60, y);
      y += 44;
      ctx.fillText(`Actual P/C/F: ${currentTotals.p} / ${currentTotals.c} / ${currentTotals.f} g`, 60, y);
      y += 44;
      ctx.fillText(`Deviation ΔP/ΔC/ΔF: ${(currentTotals.p - currentDayTarget.proteinTarget).toFixed(1)} / ${(currentTotals.c - currentDayTarget.carbTarget).toFixed(1)} / ${(currentTotals.f - currentDayTarget.fatTarget).toFixed(1)} g`, 60, y);
      y += 70;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Foods', 60, y);
      y += 42;
      ctx.font = '26px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillStyle = '#334155';
      currentEntries.forEach((e) => {
        const food = foodsMap.get(e.foodId);
        const name = lang === 'zh' ? food?.name_zh : food?.name_en;
        const v = food?.variants.find((x) => x.basis === e.basis) ?? food?.variants[0];
        const ratio = e.grams / 100;
        const p = ((v?.p ?? 0) * ratio).toFixed(1);
        const c = ((v?.c ?? 0) * ratio).toFixed(1);
        const f = ((v?.f ?? 0) * ratio).toFixed(1);
        ctx.fillText(`${food?.emoji ?? '🍽️'} ${name} (${e.basis}) ${e.grams.toFixed(1)}g  P/C/F ${p}/${c}/${f}`, 60, y);
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
      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText('Day Targets & Deviations', 60, y);
      y += 42;
      ctx.fillStyle = '#334155';
      ctx.font = '24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      deviationsByDay.forEach((d) => {
        ctx.fillText(
          `D${d.day} ${d.dayType}  T(${d.target.proteinTarget}/${d.target.carbTarget}/${d.target.fatTarget}) A(${d.totals.p}/${d.totals.c}/${d.totals.f}) Δ(${d.dp}/${d.dc}/${d.df})`,
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

  return (
    <div className="app">
      <header className="header card">
        <h1>{t(lang, 'appTitle')}</h1>
        <div className="row tight">
          <label>{t(lang, 'language')}</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as Language)}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </header>

      <section className="card grid2">
        <h2>{t(lang, 'targets')}</h2>
        <div className="field">
          <label>{t(lang, 'sex')}</label>
          <select value={profile.sex} onChange={(e) => patchProfile('sex', e.target.value)}>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </select>
        </div>

        <div className="field">
          <label>{t(lang, 'weight')}</label>
          <input type="number" value={profile.weightKg} min={30} max={300} step={0.5} onChange={(e) => patchProfile('weightKg', Number(e.target.value))} />
        </div>

        <div className="field">
          <label>{t(lang, 'bodyType')}</label>
          <select value={profile.bodyType} onChange={(e) => patchProfile('bodyType', e.target.value as 'endo' | 'ecto')}>
            <option value="endo">Endo</option>
            <option value="ecto">Ecto</option>
          </select>
        </div>

        <div className="field">
          <label>{t(lang, 'proteinPerKg')} ({profile.proteinPerKg.toFixed(1)})</label>
          <input type="range" min={0.8} max={2.0} step={0.1} value={profile.proteinPerKg} onChange={(e) => patchProfile('proteinPerKg', Number(e.target.value))} />
        </div>

        {profile.bodyType === 'ecto' && (
          <div className="field">
            <label>{t(lang, 'ectoFat')} ({profile.ectoFatPerKg.toFixed(1)})</label>
            <input
              type="range"
              min={1.0}
              max={1.2}
              step={0.1}
              value={profile.ectoFatPerKg}
              onChange={(e) => patchProfile('ectoFatPerKg', Number(e.target.value))}
            />
          </div>
        )}

        <div className="field">
          <label>{t(lang, 'cycleDays')}</label>
          <div className="row tight wrap">
            {cycleOptions.map((v) => (
              <button key={v} className={profile.cycleDays === v ? 'pill active' : 'pill'} onClick={() => setCycleDays(v)}>
                {v}
              </button>
            ))}
            <input
              type="number"
              value={profile.cycleDays}
              min={1}
              max={30}
              onChange={(e) => setCycleDays(Number(e.target.value))}
              aria-label={t(lang, 'customDays')}
            />
          </div>
        </div>

        <div className="field">
          <label>{t(lang, 'dayCounts')}</label>
          <div className="row tight">
            <input type="number" min={0} max={profile.cycleDays} value={profile.nHigh} onChange={(e) => setCounts(Number(e.target.value), profile.nMed, profile.nLow)} />
            <input type="number" min={0} max={profile.cycleDays} value={profile.nMed} onChange={(e) => setCounts(profile.nHigh, Number(e.target.value), profile.nLow)} />
            <input type="number" min={0} max={profile.cycleDays} value={profile.nLow} onChange={(e) => setCounts(profile.nHigh, profile.nMed, Number(e.target.value))} />
          </div>
          <div className="small">High / Medium / Low</div>
        </div>

        <div className="field full">
          <label>{t(lang, 'shares')}</label>
          <div className="shares-grid">
            {dayTypes.map((d) => (
              <div key={d} className="share-row">
                <strong>{d}</strong>
                <label>Carb</label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={profile.carbShares[d]}
                  onChange={(e) => setProfile((p) => ({ ...p, carbShares: { ...p.carbShares, [d]: Number(e.target.value) } }))}
                />
                <label>Fat</label>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={profile.fatShares[d]}
                  onChange={(e) => setProfile((p) => ({ ...p, fatShares: { ...p.fatShares, [d]: Number(e.target.value) } }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="field full">
          <label>{t(lang, 'dayPlacement')}</label>
          <div className="placement-grid">
            {Array.from({ length: profile.cycleDays }).map((_, idx) => (
              <div key={idx} className="row tight placement-row">
                <span>D{idx + 1}</span>
                <select value={profile.dayPlacement[idx]} onChange={(e) => setPlacement(idx, e.target.value as DayType)}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="error-box full">
            {validationErrors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        <div className="metrics full">
          <div className="metric">P_day: {cycle.pDay} g</div>
          <div className="metric">C_total: {cycle.cTotal} g</div>
          <div className="metric">F_total: {cycle.fTotal} g</div>
        </div>
      </section>

      <section className="card">
        <h2>{t(lang, 'targets')}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Type</th>
                <th>P target</th>
                <th>C target</th>
                <th>F target</th>
              </tr>
            </thead>
            <tbody>
              {cycle.dayTargets.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.dayType}</td>
                  <td>{d.proteinTarget}</td>
                  <td>{d.carbTarget}</td>
                  <td>{d.fatTarget}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>{t(lang, 'planner')}</h2>
        <div className="row wrap">
          <label>Day</label>
          <select value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>
            {cycle.dayTargets.map((d) => (
              <option key={d.day} value={d.day}>
                D{d.day} ({d.dayType})
              </option>
            ))}
          </select>

          <button onClick={handleAutoGenerate} disabled={!currentEntries.length || validationErrors.length > 0}>
            {t(lang, 'autoGenerate')}
          </button>
          <button onClick={() => renderPoster('day')}>{t(lang, 'dayPoster')}</button>
        </div>

        {currentDayTarget && (
          <div className="small">
            Target P/C/F: {currentDayTarget.proteinTarget}/{currentDayTarget.carbTarget}/{currentDayTarget.fatTarget} g
          </div>
        )}

        <div className="row wrap mt">
          <input
            className="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(lang, 'search')}
          />
          <div className="chips">
            {categories.map((c) => (
              <button key={c.key} className={category === c.key ? 'chip active' : 'chip'} onClick={() => setCategory(c.key)}>
                {c.emoji} {c.key}
              </button>
            ))}
          </div>
        </div>

        <div className="food-grid">
          {filteredFoods.slice(0, 200).map((f) => {
            const selected = currentEntries.some((e) => e.foodId === f.id);
            return (
              <button key={f.id} className={selected ? 'food-card active' : 'food-card'} onClick={() => toggleFood(f.id)}>
                <div>{f.emoji}</div>
                <div>{lang === 'zh' ? f.name_zh : f.name_en}</div>
                <small>{f.category}</small>
              </button>
            );
          })}
        </div>

        <div className="table-wrap mt">
          <table>
            <thead>
              <tr>
                <th>Food</th>
                <th>Basis</th>
                <th>Grams</th>
                <th>P</th>
                <th>C</th>
                <th>F</th>
              </tr>
            </thead>
            <tbody>
              {currentEntries.map((e) => {
                const food = foodsMap.get(e.foodId);
                const variant = food?.variants.find((v) => v.basis === e.basis) ?? food?.variants[0];
                const ratio = e.grams / 100;
                return (
                  <tr key={e.foodId}>
                    <td>{food ? `${food.emoji} ${lang === 'zh' ? food.name_zh : food.name_en}` : e.foodId}</td>
                    <td>
                      <select value={e.basis} onChange={(ev) => patchEntry(e.foodId, { basis: ev.target.value as Basis })}>
                        {(food?.variants ?? []).map((v) => (
                          <option key={v.basis} value={v.basis}>
                            {v.basis}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={e.grams}
                        onChange={(ev) => patchEntry(e.foodId, { grams: Number(ev.target.value) })}
                      />
                    </td>
                    <td>{((variant?.p ?? 0) * ratio).toFixed(1)}</td>
                    <td>{((variant?.c ?? 0) * ratio).toFixed(1)}</td>
                    <td>{((variant?.f ?? 0) * ratio).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {currentDayTarget && (
          <div className="metrics">
            <div className="metric">
              ΔP: {(currentTotals.p - currentDayTarget.proteinTarget).toFixed(1)}
            </div>
            <div className="metric">
              ΔC: {(currentTotals.c - currentDayTarget.carbTarget).toFixed(1)}
            </div>
            <div className="metric">
              ΔF: {(currentTotals.f - currentDayTarget.fatTarget).toFixed(1)}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t(lang, 'addCustomFood')}</h2>
        <div className="grid3">
          <input placeholder="Name (EN)" value={customForm.name_en} onChange={(e) => setCustomForm((f) => ({ ...f, name_en: e.target.value }))} />
          <input placeholder="名称 (中文)" value={customForm.name_zh} onChange={(e) => setCustomForm((f) => ({ ...f, name_zh: e.target.value }))} />
          <select value={customForm.category} onChange={(e) => setCustomForm((f) => ({ ...f, category: e.target.value as Category }))}>
            <option value="protein">protein</option>
            <option value="carb">carb</option>
            <option value="fat">fat</option>
            <option value="veg">veg</option>
            <option value="fruit">fruit</option>
            <option value="dairy">dairy</option>
            <option value="other">other</option>
          </select>
          <select value={customForm.basis} onChange={(e) => setCustomForm((f) => ({ ...f, basis: e.target.value as Basis }))}>
            <option value="raw">raw</option>
            <option value="cooked">cooked</option>
            <option value="fresh">fresh</option>
          </select>
          <input type="number" placeholder="P" value={customForm.p} onChange={(e) => setCustomForm((f) => ({ ...f, p: Number(e.target.value) }))} />
          <input type="number" placeholder="C" value={customForm.c} onChange={(e) => setCustomForm((f) => ({ ...f, c: Number(e.target.value) }))} />
          <input type="number" placeholder="F" value={customForm.f} onChange={(e) => setCustomForm((f) => ({ ...f, f: Number(e.target.value) }))} />
          <input type="number" placeholder="kcal" value={customForm.kcal} onChange={(e) => setCustomForm((f) => ({ ...f, kcal: Number(e.target.value) }))} />
        </div>
        <div className="row mt">
          <button onClick={addCustomFood}>{t(lang, 'addCustomFood')}</button>
        </div>
      </section>

      <section className="card">
        <h2>{t(lang, 'deviation')}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Type</th>
                <th>ΔP</th>
                <th>ΔC</th>
                <th>ΔF</th>
              </tr>
            </thead>
            <tbody>
              {deviationsByDay.map((d) => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td>{d.dayType}</td>
                  <td>{d.dp}</td>
                  <td>{d.dc}</td>
                  <td>{d.df}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="row wrap mt">
          <button onClick={exportCycleCsv}>{t(lang, 'exportCsv')}</button>
          <button onClick={exportAllXlsx}>{t(lang, 'exportXlsx')}</button>
          <button onClick={() => renderPoster('cycle')}>{t(lang, 'cyclePoster')}</button>
        </div>
      </section>

      <canvas ref={dayCanvasRef} style={{ display: 'none' }} />
      <canvas ref={cycleCanvasRef} style={{ display: 'none' }} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
