import { describe, expect, it } from 'vitest'
import { rolls } from './copy'

describe('Polish roll counts', () => {
  it.each([
    [0, '0 rzutów'],
    [1, '1 rzut'],
    [2, '2 rzuty'],
    [4, '4 rzuty'],
    [5, '5 rzutów'],
    [11, '11 rzutów'],
    [12, '12 rzutów'],
    [14, '14 rzutów'],
    [21, '21 rzutów'],
    [22, '22 rzuty'],
    [104, '104 rzuty'],
    [112, '112 rzutów'],
  ])('%i → %s', (n, text) => {
    expect(rolls(n)).toBe(text)
  })
})
