import type { Basis, Category, DayFoodEntry, DayTarget, FoodItem, Language } from '../types';

interface FoodsTabProps {
  lang: Language;
  selectedDay: number;
  dayTargets: DayTarget[];
  currentDayTarget?: DayTarget;
  currentEntries: DayFoodEntry[];
  currentTotals: { p: number; c: number; f: number; kcal: number };
  validationErrors: string[];
  search: string;
  category: Category | 'all';
  categories: Array<{ key: Category | 'all'; label: string }>;
  filteredFoods: FoodItem[];
  foodsMap: Map<string, FoodItem>;
  customForm: {
    name_en: string;
    name_zh: string;
    category: Category;
    basis: Basis;
    p: number;
    c: number;
    f: number;
    kcal: number;
  };
  onSetSelectedDay: (day: number) => void;
  onSearch: (q: string) => void;
  onCategory: (cat: Category | 'all') => void;
  onToggleFood: (foodId: string) => void;
  onPatchEntry: (foodId: string, patch: Partial<DayFoodEntry>) => void;
  onAutoGenerate: () => void;
  onExportDayPoster: () => void;
  onSetCustomForm: (patch: Partial<FoodsTabProps['customForm']>) => void;
  onAddCustomFood: () => void;
}

export function FoodsTab(props: FoodsTabProps) {
  const {
    lang,
    selectedDay,
    dayTargets,
    currentDayTarget,
    currentEntries,
    currentTotals,
    validationErrors,
    search,
    category,
    categories,
    filteredFoods,
    foodsMap,
    customForm,
    onSetSelectedDay,
    onSearch,
    onCategory,
    onToggleFood,
    onPatchEntry,
    onAutoGenerate,
    onExportDayPoster,
    onSetCustomForm,
    onAddCustomFood
  } = props;

  return (
    <section className="surface stack-16 with-bottom-pad">
      <h2 className="title">Foods</h2>

      <div className="row wrap">
        <label>Day</label>
        <select value={selectedDay} onChange={(e) => onSetSelectedDay(Number(e.target.value))}>
          {dayTargets.map((d) => (
            <option key={d.day} value={d.day}>
              D{d.day} ({d.dayType})
            </option>
          ))}
        </select>
        <button onClick={onAutoGenerate} disabled={!currentEntries.length || validationErrors.length > 0}>
          Auto-generate grams
        </button>
        <button onClick={onExportDayPoster}>Export Day Poster</button>
      </div>

      <div className="foods-layout">
        <aside className="stack-16">
          <div className="subsurface stack-8">
            <h3 className="subtitle">Targets</h3>
            {currentDayTarget && (
              <>
                <div className="small">Type: {currentDayTarget.dayType}</div>
                <div className="small">P/C/F target: {currentDayTarget.proteinTarget}/{currentDayTarget.carbTarget}/{currentDayTarget.fatTarget} g</div>
                <div className="small">Actual: {currentTotals.p}/{currentTotals.c}/{currentTotals.f} g</div>
                <div className="small">kcal: {currentTotals.kcal}</div>
              </>
            )}
          </div>

          <div className="subsurface stack-8">
            <h3 className="subtitle">Selected Foods</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Food</th>
                    <th>Basis</th>
                    <th>g</th>
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
                        <td>{food ? (lang === 'zh' ? food.name_zh : food.name_en) : e.foodId}</td>
                        <td>
                          <select value={e.basis} onChange={(ev) => onPatchEntry(e.foodId, { basis: ev.target.value as Basis })}>
                            {(food?.variants ?? []).map((v) => (
                              <option key={v.basis} value={v.basis}>{v.basis}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input type="number" min={0} step={5} value={e.grams} onChange={(ev) => onPatchEntry(e.foodId, { grams: Number(ev.target.value) })} />
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
          </div>
        </aside>

        <main className="stack-16">
          <div className="subsurface stack-8">
            <input className="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search foods" />
            <div className="category-segment" role="tablist" aria-label="Food categories">
              {categories.map((c) => (
                <button
                  key={c.key}
                  className={category === c.key ? 'seg-btn active' : 'seg-btn'}
                  onClick={() => onCategory(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="food-grid">
              {filteredFoods.slice(0, 220).map((f) => {
                const selected = currentEntries.some((e) => e.foodId === f.id);
                const primary = f.variants[0];
                return (
                  <button key={f.id} className={selected ? 'food-card active' : 'food-card'} onClick={() => onToggleFood(f.id)}>
                    <div className="food-name">{lang === 'zh' ? f.name_zh : f.name_en}</div>
                    <div className="food-sub">{f.category}</div>
                    <div className="food-sub">{Math.round(primary.kcal ?? 0)} kcal / 100g</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="subsurface stack-8">
            <h3 className="subtitle">Add Custom Food</h3>
            <div className="grid three">
              <input placeholder="Name (EN)" value={customForm.name_en} onChange={(e) => onSetCustomForm({ name_en: e.target.value })} />
              <input placeholder="名称 (中文)" value={customForm.name_zh} onChange={(e) => onSetCustomForm({ name_zh: e.target.value })} />
              <select value={customForm.category} onChange={(e) => onSetCustomForm({ category: e.target.value as Category })}>
                <option value="protein">protein</option>
                <option value="carb">carb</option>
                <option value="fat">fat</option>
                <option value="veg">veg</option>
                <option value="fruit">fruit</option>
                <option value="dairy">dairy</option>
                <option value="other">other</option>
              </select>
              <select value={customForm.basis} onChange={(e) => onSetCustomForm({ basis: e.target.value as Basis })}>
                <option value="raw">raw</option>
                <option value="cooked">cooked</option>
                <option value="fresh">fresh</option>
              </select>
              <input type="number" placeholder="P" value={customForm.p} onChange={(e) => onSetCustomForm({ p: Number(e.target.value) })} />
              <input type="number" placeholder="C" value={customForm.c} onChange={(e) => onSetCustomForm({ c: Number(e.target.value) })} />
              <input type="number" placeholder="F" value={customForm.f} onChange={(e) => onSetCustomForm({ f: Number(e.target.value) })} />
              <input type="number" placeholder="kcal" value={customForm.kcal} onChange={(e) => onSetCustomForm({ kcal: Number(e.target.value) })} />
            </div>
            <button onClick={onAddCustomFood}>Save Custom Food</button>
          </div>
        </main>
      </div>
    </section>
  );
}
