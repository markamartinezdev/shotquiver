import { describe, expect, it } from 'vitest'
import {
  rounds,
  fieldStations,
  endRound,
  sessionRound,
  customRound,
  validateCustom,
} from './rounds'
import { createSession, sessionStats, withArrow } from './scoring'
import { makeBackup, parseBackup } from '../data/backup'
import type { CustomConfig } from './types'

const config: CustomConfig = {
  id: 'test-custom',
  name: 'Evening practice',
  ends: 2,
  arrowsPerEnd: 3,
  distance: 18,
  unit: 'meters',
  targetDiameterCm: 60,
  face: 'rings',
  maxScore: 10,
  useX: true,
}
describe('Field rounds', () => {
  it.each([
    ['nfaa-field-28', 560, 112],
    ['nfaa-field-28-pro', 672, 112],
    ['nfaa-field-14', 280, 56],
    ['nfaa-field-14-pro', 336, 56],
  ])('scores a perfect %s', (id, max, arrows) => {
    const s = createSession(rounds[id as string])
    s.ends.forEach((e) => {
      e.arrows.fill({ score: 'X' })
      e.committed = true
    })
    expect(sessionStats(s)).toMatchObject({
      total: max,
      max,
      xs: arrows,
      count: arrows,
      complete: true,
    })
  })
  it('contains all official adult stations including feet and fan', () => {
    expect(fieldStations).toHaveLength(14)
    expect(fieldStations.map((s) => s.targetDiameterCm)).toEqual([
      35, 35, 35, 35, 50, 50, 50, 65, 65, 65, 50, 50, 65, 20,
    ])
    expect(fieldStations[10].instruction).toContain('Fan')
    expect(fieldStations[13].distance).toBe('35 / 30 / 25 / 20 feet')
  })
  it('uses 5/4/3 geometry, and actual face diameter for shaft contact', () => {
    const s = createSession(rounds['nfaa-field-28'])
    for (const index of [0, 4, 7, 13]) {
      const face = endRound(s, index),
        contact = 6 / (face.targetDiameterCm * 10)
      for (const [r, score] of [
        [0.1, 'X'],
        [0.2, '5'],
        [0.6, '4'],
        [1, '3'],
      ] as const) {
        expect(face.scorePosition({ x: r + contact, y: 0 }, 6)).toBe(score)
        expect(
          face.scorePosition({ x: r + contact + 0.0001, y: 0 }, 6)
        ).not.toBe(score)
      }
      expect(face.scorePosition({ x: 0.4, y: 0 }, 0)).toBe('4')
      expect(face.scorePosition({ x: 0.8, y: 0 }, 0)).toBe('3')
    }
  })
  it('preserves reordered stations and positions in backups', () => {
    let s = createSession(rounds['nfaa-field-28'])
    ;[s.fieldOrder![0], s.fieldOrder![13]] = [13, 0]
    s = withArrow(s, 0, 0, { score: 'X', position: { x: 0.125, y: 0 } })
    expect(endRound(s, 0).targetDiameterCm).toBe(20)
    const restored = parseBackup(JSON.stringify(makeBackup([s])))[0]
    expect(restored).toEqual(s)
    restored.fieldOrder![1] = 13
    expect(() => parseBackup(JSON.stringify(makeBackup([restored])))).toThrow(
      'course order'
    )
  })
})
describe('Custom rounds', () => {
  it('snapshots rules and restores them without a registry entry', () => {
    let s = createSession(customRound(config))
    s = withArrow(s, 0, 0, { score: 'X', position: { x: 0, y: 0 } })
    expect(s.roundId).toBe('custom')
    const restored = parseBackup(JSON.stringify(makeBackup([s])))[0]
    expect(restored).toEqual(s)
    expect(sessionStats(restored)).toMatchObject({
      max: 60,
      total: 10,
      xs: 1,
      average: 10,
    })
    expect(sessionRound(restored).distance).toBe('18 meters')
  })
  it('can disable X and use alternative face patterns', () => {
    const noX = customRound({ ...config, useX: false })
    expect(noX.scores).not.toContain('X')
    expect(noX.scorePosition({ x: 0, y: 0 }, 0)).toBe('10')
    const field = customRound({ ...config, face: 'field', maxScore: 5 })
    expect(field.scores).toEqual(['X', '5', '4', '3', 'M'])
    expect(field.scorePosition({ x: 0.5, y: 0 }, 0)).toBe('4')
  })
  it.each([
    { ends: 0 },
    { arrowsPerEnd: 13 },
    { maxScore: 11 },
    { targetDiameterCm: 0 },
    { name: '' },
    { unit: 'parsecs' },
    { useX: 'yes' },
    { face: 'field', maxScore: 10 },
  ])('rejects malformed settings %j', (invalid) => {
    expect(() => validateCustom({ ...config, ...invalid })).toThrow()
  })
})
