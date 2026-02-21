import type { DayType, PlannerProfile } from '../types';

interface PlanRow {
  day: number;
  dayType: DayType;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
}

interface DeviationRow {
  day: number;
  dayType: DayType;
  dp: number;
  dc: number;
  df: number;
}

interface PlanTabProps {
  profile: PlannerProfile;
  cycle: { dayTargets: PlanRow[]; pDay: number; cTotal: number; fTotal: number };
  errors: string[];
  deviations: DeviationRow[];
  setCounts: (high: number, med: number, low: number) => void;
  setPlacement: (dayIndex: number, type: DayType) => void;
  setCarbShare: (type: DayType, value: number) => void;
  setFatShare: (type: DayType, value: number) => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPoster: () => void;
}

const dayTypes: DayType[] = ['High', 'Medium', 'Low'];

export function PlanTab({
  profile,
  cycle,
  errors,
  deviations,
  setCounts,
  setPlacement,
  setCarbShare,
  setFatShare,
  onExportCsv,
  onExportXlsx,
  onExportPoster
}: PlanTabProps) {
  return (
    <section className="surface stack-24">
      <h2 className="title">Plan</h2>

      <div className="grid two">
        <div className="field">
          <label>Day Counts (High / Medium / Low)</label>
          <div className="inline-3">
            <input type="number" min={0} max={profile.cycleDays} value={profile.nHigh} onChange={(e) => setCounts(Number(e.target.value), profile.nMed, profile.nLow)} />
            <input type="number" min={0} max={profile.cycleDays} value={profile.nMed} onChange={(e) => setCounts(profile.nHigh, Number(e.target.value), profile.nLow)} />
            <input type="number" min={0} max={profile.cycleDays} value={profile.nLow} onChange={(e) => setCounts(profile.nHigh, profile.nMed, Number(e.target.value))} />
          </div>
        </div>

        <div className="summary-row">
          <div className="mini-metric">P_day {cycle.pDay}g</div>
          <div className="mini-metric">C_total {cycle.cTotal}g</div>
          <div className="mini-metric">F_total {cycle.fTotal}g</div>
        </div>

        <div className="field full">
          <label>Macro Shares</label>
          <div className="share-table">
            {dayTypes.map((d) => (
              <div key={d} className="share-line">
                <strong>{d}</strong>
                <span>Carb</span>
                <input type="number" min={0} max={1} step={0.01} value={profile.carbShares[d]} onChange={(e) => setCarbShare(d, Number(e.target.value))} />
                <span>Fat</span>
                <input type="number" min={0} max={1} step={0.01} value={profile.fatShares[d]} onChange={(e) => setFatShare(d, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </div>

        <div className="field full">
          <label>Day Type Placement (counts fixed)</label>
          <div className="placement-grid">
            {Array.from({ length: profile.cycleDays }).map((_, idx) => (
              <div className="placement-item" key={idx}>
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
      </div>

      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

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
            {deviations.map((d) => (
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

      <div className="row">
        <button onClick={onExportCsv}>Export CSV</button>
        <button onClick={onExportXlsx}>Export XLSX</button>
        <button onClick={onExportPoster}>Export Cycle Poster</button>
      </div>
    </section>
  );
}
