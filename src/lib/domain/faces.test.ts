import { describe, expect, it } from 'vitest'
import {
  indoor300,
  rounds,
  withTargetFace,
  sessionRound,
  endRound,
  customRound,
} from './rounds'
import { createSession, withArrow, sessionStats } from './scoring'
import { makeBackup, parseBackup } from '../data/backup'

describe('Selectable target faces', () => {
  const five = withTargetFace(indoor300, 'five-spot')
  it('scores every spot center and permits repeated arrows on one spot', () => {
    expect(five.scores).toEqual(['X', '5', '4', 'M'])
    for (const p of five.targetFace!.centers)
      expect(five.scorePosition(p, 0)).toBe('X')
    let s = createSession(five)
    for (let i = 0; i < 5; i++)
      s = withArrow(s, 0, i, { score: 'X', position: { x: -0.6, y: -0.6 } })
    expect(sessionStats(s)).toMatchObject({ total: 25, xs: 5, max: 300 })
  })
  it('uses 4/8/12/16 cm diameters and treats blue gaps as misses', () => {
    for (const [radius, score] of [
      [0.1, 'X'],
      [0.2, '5'],
      [0.3, '4'],
      [0.4, '4'],
    ] as const)
      expect(five.scorePosition({ x: radius, y: 0 }, 0)).toBe(score)
    expect(five.scorePosition({ x: 0.401, y: 0 }, 0)).toBe('M')
    expect(five.scorePosition({ x: 0.6, y: 0 }, 0)).toBe('M')
    expect(five.scorePosition({ x: 0.415, y: 0 }, 6)).toBe('4')
    expect(five.scorePosition({ x: 0.4151, y: 0 }, 6)).toBe('M')
    expect(five.scorePosition({ x: 0.215, y: 0 }, 6)).toBe('5')
    expect(five.scorePosition({ x: 0.115, y: 0 }, 6)).toBe('X')
  })
  it('restores all single-spot rings when switching back', () => {
    const single = withTargetFace(five, 'single')
    expect(single.scores).toEqual(indoor300.scores)
    expect(single.scorePosition({ x: 0.9, y: 0 }, 0)).toBe('1')
  })
  it('scales four full Field faces to each station diameter', () => {
    const s = createSession(
      withTargetFace(rounds['nfaa-field-28'], 'four-face')
    )
    for (const index of [0, 4, 7, 13]) {
      const face = endRound(s, index),
        layout = face.targetFace!
      expect(layout.boardDiameterCm).toBe(face.targetDiameterCm * 2)
      for (const p of layout.centers) expect(face.scorePosition(p, 0)).toBe('X')
      expect(face.scorePosition({ x: 0, y: 0 }, 0)).toBe('M')
      const contact = 6 / (layout.boardDiameterCm * 10)
      expect(face.scorePosition({ x: 0.5 + 0.1 + contact, y: 0.5 }, 6)).toBe(
        '5'
      )
      expect(
        face.scorePosition({ x: 0.5 + 0.1 + contact + 0.0001, y: 0.5 }, 6)
      ).toBe('4')
    }
  })
  it('preserves layouts and global positions through backups', () => {
    const s = withArrow(createSession(five), 0, 0, {
      score: 'X',
      position: { x: 0.6, y: -0.6 },
    })
    expect(parseBackup(JSON.stringify(makeBackup([s])))).toEqual([s])
    expect(sessionRound(s).targetFace?.id).toBe('five-spot')
    const old = createSession()
    delete old.targetFace
    expect(
      sessionRound(parseBackup(JSON.stringify(makeBackup([old])))[0]).targetFace
        ?.id
    ).toBe('single')
  })
  it('rejects incompatible faces and low scores on a five-spot face', () => {
    const invalid = createSession(five)
    invalid.ends[0].arrows[0] = { score: '3' }
    expect(() => parseBackup(JSON.stringify(makeBackup([invalid])))).toThrow()
    expect(() => withTargetFace(rounds['nfaa-field-28'], 'five-spot')).toThrow()
    expect(() => withTargetFace(indoor300, 'four-face')).toThrow()
  })
  it('supports scaled custom Indoor patterns with the same layout', () => {
    const r = withTargetFace(
      customRound({
        id: 'scaled',
        name: 'Scaled practice',
        ends: 2,
        arrowsPerEnd: 3,
        distance: 10,
        unit: 'meters',
        targetDiameterCm: 60,
        face: 'indoor',
        maxScore: 5,
        useX: true,
      }),
      'five-spot'
    )
    const s = createSession(r)
    expect(sessionRound(s).targetFace?.boardDiameterCm).toBe(60)
    expect(r.scorePosition({ x: 0.11, y: 0 }, 6)).toBe('X')
    expect(r.scorePosition({ x: 0.1101, y: 0 }, 6)).toBe('5')
    expect(parseBackup(JSON.stringify(makeBackup([s])))).toEqual([s])
  })
})
