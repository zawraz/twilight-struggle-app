import { describe, expect, it } from 'vitest'
import { average, formatAverage, formatSigned, sum } from './stats'

describe('stats', () => {
  it('sums values', () => {
    expect(sum([])).toBe(0)
    expect(sum([3, -2, 5])).toBe(6)
  })

  it('averages values, or returns null when empty', () => {
    expect(average([])).toBeNull()
    expect(average([1, 2, 6])).toBe(3)
  })

  it('formats signed numbers with a true minus sign', () => {
    expect(formatSigned(4)).toBe('+4')
    expect(formatSigned(0)).toBe('0')
    expect(formatSigned(-3)).toBe('−3')
  })

  it('formats averages to two decimals with a Polish comma, or a dash when empty', () => {
    expect(formatAverage(3.5)).toBe('3,50')
    expect(formatAverage(null)).toBe('—')
  })
})
