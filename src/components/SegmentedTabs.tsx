export type MainTab = 'profile' | 'plan' | 'foods';

interface SegmentedTabsProps {
  active: MainTab;
  onChange: (tab: MainTab) => void;
}

const tabs: Array<{ key: MainTab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'plan', label: 'Plan' },
  { key: 'foods', label: 'Foods' }
];

export function SegmentedTabs({ active, onChange }: SegmentedTabsProps) {
  return (
    <div className="segmented-tabs" role="tablist" aria-label="Main Sections">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          className={active === tab.key ? 'seg-btn active' : 'seg-btn'}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
