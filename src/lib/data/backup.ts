import { sessionRound, endRound, validateCustom } from '../domain/rounds'
import type { Session } from '../domain/types'

// Stable file-format identifier, retained across the ShotQuiver rebrand.
export interface Backup {
  format: 'trueflight-backup'
  version: 1
  exportedAt: string
  sessions: Session[]
}
export function makeBackup(sessions: Session[]): Backup {
  return {
    format: 'trueflight-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
  }
}

export function parseBackup(text: string): Session[] {
  if (text.length > 5_000_000)
    throw new Error('Backup is too large. Maximum size is 5 MB.')
  const data = JSON.parse(text)
  if (
    data?.format !== 'trueflight-backup' ||
    data.version !== 1 ||
    !Array.isArray(data.sessions) ||
    data.sessions.length > 1000
  )
    throw new Error(
      'Choose a valid ShotQuiver v1 backup (up to 1,000 sessions).'
    )
  const ids = new Set<string>()
  for (const s of data.sessions) {
    if (
      s?.targetFace !== undefined &&
      !['single', 'five-spot', 'four-face'].includes(s.targetFace)
    )
      throw new Error('Invalid target face.')
    const round = sessionRound(s)
    if (
      s.fieldOrder !== undefined &&
      (!round.stations ||
        !Array.isArray(s.fieldOrder) ||
        s.fieldOrder.length !== round.ends ||
        s.fieldOrder.some(
          (v: unknown, i: number) =>
            !Number.isInteger(v) ||
            Number(v) < Math.floor(i / 14) * 14 ||
            Number(v) >= Math.floor(i / 14) * 14 + 14
        ) ||
        new Set(s.fieldOrder).size !== round.ends)
    )
      throw new Error('Invalid Field course order.')
    if (
      !round ||
      typeof s.id !== 'string' ||
      !s.id ||
      s.id.length > 100 ||
      ids.has(s.id) ||
      typeof s.notes !== 'string' ||
      s.notes.length > 10000 ||
      typeof s.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(s.createdAt)) ||
      typeof s.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(s.updatedAt)) ||
      !Number.isFinite(s.shaftDiameterMm) ||
      s.shaftDiameterMm < 0 ||
      s.shaftDiameterMm > 15 ||
      !Array.isArray(s.ends) ||
      s.ends.length !== round.ends
    )
      throw new Error('Backup contains an invalid or unsupported session.')
    ids.add(s.id)
    for (const [index, end] of s.ends.entries()) {
      if (
        !end ||
        typeof end.committed !== 'boolean' ||
        !Array.isArray(end.arrows) ||
        end.arrows.length !== round.arrowsPerEnd
      )
        throw new Error('Backup contains an invalid end.')
      for (const arrow of end.arrows) {
        if (arrow === null) continue
        if (!arrow || !round.scores.includes(arrow.score))
          throw new Error('Backup contains an invalid arrow score.')
        if (arrow.position !== undefined) {
          const p = arrow.position
          if (
            !p ||
            !Number.isFinite(p.x) ||
            !Number.isFinite(p.y) ||
            Math.abs(p.x) > 1.25 ||
            Math.abs(p.y) > 1.25 ||
            endRound(s, index).scorePosition(p, s.shaftDiameterMm) !==
              arrow.score
          )
            throw new Error('Backup contains an invalid arrow position.')
        }
      }
      if (end.committed && end.arrows.some((a: unknown) => a === null))
        throw new Error('A saved end must contain all arrows.')
    }
  }
  // Only retain known fields; imported objects never become application configuration.
  return data.sessions.map((s: Session) => ({
    id: s.id,
    roundId: s.roundId,
    ...(s.targetFace !== undefined ? { targetFace: s.targetFace } : {}),
    ...(s.roundId === 'custom'
      ? { customConfig: validateCustom(s.customConfig) }
      : {}),
    ...(s.fieldOrder ? { fieldOrder: [...s.fieldOrder] } : {}),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    notes: s.notes,
    shaftDiameterMm: s.shaftDiameterMm,
    ends: s.ends.map((e) => ({
      committed: e.committed,
      arrows: e.arrows.map((a) =>
        a === null
          ? null
          : {
              score: a.score,
              ...(a.position
                ? { position: { x: a.position.x, y: a.position.y } }
                : {}),
            }
      ),
    })),
  }))
}
