interface MacroDeltaBarProps {
  proteinRemaining: number;
  carbRemaining: number;
  fatRemaining: number;
}

function statusClass(v: number): 'ok' | 'warn' | 'over' {
  const abs = Math.abs(v);
  if (abs <= 3) return 'ok';
  if (v < 0) return 'over';
  return 'warn';
}

export function MacroDeltaBar({ proteinRemaining, carbRemaining, fatRemaining }: MacroDeltaBarProps) {
  const items = [
    { label: 'Protein', value: proteinRemaining },
    { label: 'Carb', value: carbRemaining },
    { label: 'Fat', value: fatRemaining }
  ];

  return (
    <div className="macro-delta-bar" aria-live="polite">
      {items.map((it) => (
        <div key={it.label} className={`delta-item ${statusClass(it.value)}`}>
          <span>{it.label}</span>
          <strong>{it.value >= 0 ? '+' : ''}{it.value.toFixed(1)}g</strong>
        </div>
      ))}
    </div>
  );
}
