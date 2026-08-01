export function pct(value: number | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

export function num(value: number | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(digits);
}

export function compactInt(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}
