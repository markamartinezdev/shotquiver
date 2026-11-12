import { describe, expect, it } from 'vitest'
import { createSession, withArrow } from '../domain/scoring'
import { makeBackup, parseBackup } from './backup'

describe('JSON backups', () => {
  it('round-trips scores, positions, notes, and partial ends', () => {
    const session = withArrow(createSession(), 0, 0, {
      score: 'X',
      position: { x: 0, y: 0 },
    })
    session.notes = 'Brace height 7.5 inches. Smooth follow-through.'
    expect(parseBackup(JSON.stringify(makeBackup([session])))).toEqual([
      session,
    ])
  })
  it.each([
    'format',
    'round',
    'score',
    'position',
    'end',
    'date',
    'duplicate',
    'shaft',
    'notes',
  ])('rejects invalid %s before writing any data', (kind) => {
    const s = createSession()
    const backup = makeBackup([s])
    const invalid = backup as any
    if (kind === 'format') invalid.version = 2
    if (kind === 'round') s.roundId = 'unimplemented-round'
    if (kind === 'score')
      invalid.sessions[0].ends[0].arrows[0] = { score: '10' }
    if (kind === 'position')
      s.ends[0].arrows[0] = { score: 'M', position: { x: 0, y: 0 } }
    if (kind === 'end') s.ends[0].committed = true
    if (kind === 'date') s.createdAt = 'yesterday'
    if (kind === 'duplicate') backup.sessions.push(s)
    if (kind === 'shaft') s.shaftDiameterMm = -2
    if (kind === 'notes') invalid.sessions[0].notes = 99
    expect(() => parseBackup(JSON.stringify(backup))).toThrow()
  })
  it('rejects oversized inputs', () =>
    expect(() => parseBackup(' '.repeat(5_000_001))).toThrow('too large'))
})
