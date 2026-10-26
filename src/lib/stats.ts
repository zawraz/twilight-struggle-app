const MINUS = '−'

export function sum(values: readonly number[]): number {
  return values.reduce((total, v) => total + v, 0)
}

export function average(values: readonly number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length
}

/** "+3", "0", "−2" — with a true minus sign. */
export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `${MINUS}${Math.abs(value)}`
  return '0'
}

/** "3,50" (Polish decimal comma), or an em dash when there is nothing to average. */
export function formatAverage(value: number | null): string {
  return value === null ? '—' : value.toFixed(2).replace('.', ',')
}
