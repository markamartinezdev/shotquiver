import { describe, expect, it } from 'vitest'
import { indoor300, indoorScorePosition } from './rounds'
import {
  createSession,
  endStats,
  firstOpenEnd,
  sessionStats,
  withArrow,
} from './scoring'

describe('NFAA Indoor 300', () => {
  it('creates twelve independent ends of five empty arrows', () => {
    const session = createSession()
    expect(session.ends).toHaveLength(12)
    expect(
      session.ends.every(
        (e) => e.arrows.length === 5 && e.arrows.every((a) => a === null)
      )
    ).toBe(true)
    expect(session.ends[0].arrows).not.toBe(session.ends[1].arrows)
    expect(sessionStats(session)).toMatchObject({
      total: 0,
      average: 0,
      max: 300,
      complete: false,
    })
  })
  it('counts X as five, misses as zero, and includes misses in the average', () => {
    let session = createSession()
    for (const [i, score] of (['X', '5', '4', '1', 'M'] as const).entries())
      session = withArrow(session, 0, i, { score })
    expect(endStats(session.ends[0], indoor300)).toEqual({
      total: 15,
      count: 5,
      xs: 1,
    })
    expect(sessionStats(session)).toMatchObject({
      total: 15,
      average: 3,
      xs: 1,
      count: 5,
    })
  })
  it('caps a perfect round at 300 with 60 X and requires saved ends for completion', () => {
    let session = createSession()
    for (let end = 0; end < 12; end++)
      for (let arrow = 0; arrow < 5; arrow++)
        session = withArrow(session, end, arrow, { score: 'X' })
    expect(sessionStats(session)).toMatchObject({
      total: 300,
      xs: 60,
      complete: false,
    })
    session.ends.forEach((e) => (e.committed = true))
    expect(sessionStats(session)).toMatchObject({
      complete: true,
      completedEnds: 12,
      average: 5,
    })
  })
  it('recomputes previous ends immutably and reopens cleared saved ends', () => {
    const before = createSession()
    before.ends[0].arrows.fill({ score: 'X' })
    before.ends[0].committed = true
    const after = withArrow(before, 0, 1, { score: '3' })
    expect(sessionStats(before).total).toBe(25)
    expect(sessionStats(after).total).toBe(23)
    expect(firstOpenEnd(after)).toBe(1)
    const cleared = withArrow(after, 0, 1, null)
    expect(cleared.ends[0].committed).toBe(false)
    expect(firstOpenEnd(cleared)).toBe(0)
  })
})

describe('40 cm target geometry', () => {
  it.each([
    [0, 'X'],
    [0.1, 'X'],
    [0.1001, '5'],
    [0.2, '5'],
    [0.2001, '4'],
    [0.4, '4'],
    [0.4001, '3'],
    [0.6, '3'],
    [0.6001, '2'],
    [0.8, '2'],
    [0.8001, '1'],
    [1, '1'],
    [1.0001, 'M'],
  ] as const)(
    'scores normalized radius %s as %s for a point shaft',
    (radius, score) => {
      expect(indoorScorePosition({ x: radius, y: 0 }, 0)).toBe(score)
      expect(indoorScorePosition({ x: 0, y: -radius }, 0)).toBe(score)
    }
  )
  it('uses shaft contact at every scoring boundary', () => {
    for (const [radius, expected] of [
      [0.1, 'X'],
      [0.2, '5'],
      [0.4, '4'],
      [0.6, '3'],
      [0.8, '2'],
      [1, '1'],
    ] as const) {
      expect(indoorScorePosition({ x: radius + 0.015, y: 0 }, 6)).toBe(expected)
      expect(indoorScorePosition({ x: radius + 0.0151, y: 0 }, 6)).not.toBe(
        expected
      )
    }
  })
})
