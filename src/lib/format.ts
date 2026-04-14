export function formatPct(rate: number): string {
  return (rate * 100).toFixed(2) + "%";
}

export function formatDollars(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}
