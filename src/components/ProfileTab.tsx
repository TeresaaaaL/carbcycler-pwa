import type { Language, PlannerProfile } from '../types';
import { t } from '../i18n';

interface ProfileTabProps {
  lang: Language;
  profile: PlannerProfile;
  cycleOptions: number[];
  patchProfile: <K extends keyof PlannerProfile>(key: K, value: PlannerProfile[K]) => void;
  setCycleDays: (days: number) => void;
}

export function ProfileTab({ lang, profile, cycleOptions, patchProfile, setCycleDays }: ProfileTabProps) {
  return (
    <section className="surface">
      <h2 className="title">Profile</h2>
      <div className="grid two">
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
          <input
            type="number"
            value={profile.weightKg}
            min={30}
            max={300}
            step={0.5}
            onChange={(e) => patchProfile('weightKg', Number(e.target.value))}
          />
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
          <input
            type="range"
            min={0.8}
            max={2.0}
            step={0.1}
            value={profile.proteinPerKg}
            onChange={(e) => patchProfile('proteinPerKg', Number(e.target.value))}
          />
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
          <div className="segmented-inline">
            {cycleOptions.map((v) => (
              <button key={v} className={profile.cycleDays === v ? 'seg-btn active' : 'seg-btn'} onClick={() => setCycleDays(v)}>
                {v}
              </button>
            ))}
            <input
              className="days-input"
              type="number"
              min={1}
              max={30}
              value={profile.cycleDays}
              onChange={(e) => setCycleDays(Number(e.target.value))}
              aria-label={t(lang, 'customDays')}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
