interface MiniStatBarProps {
  label: string;
  value: number;
  /** 0–100 的百分比条；平均名次等需自行换算 */
  percent: number;
  display: string;
  accent?: string;
}

export function MiniStatBar({ label, value: _value, percent, display, accent = "bg-indigo-400" }: MiniStatBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="min-w-[96px] flex-1">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className="font-medium text-[var(--text-primary)]">{display}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/** 平均名次：越低越好，按 1–8 映射到条长度（名次 1 → 100%） */
export function avgPlaceToPercent(avgPlace: number): number {
  if (!Number.isFinite(avgPlace)) return 0;
  return Math.max(0, Math.min(100, ((8 - avgPlace) / 7) * 100));
}
