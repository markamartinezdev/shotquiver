import { indoor300, sessionRound } from './rounds'
import type { Arrow, End, RoundDefinition, Session } from './types'

export function createSession(round: RoundDefinition = indoor300): Session {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    roundId: round.family === 'custom' ? 'custom' : round.id,
    targetFace: round.targetFace?.id ?? 'single',
    ...(round.customConfig
      ? { customConfig: structuredClone(round.customConfig) }
      : {}),
    ...(round.stations
      ? { fieldOrder: Array.from({ length: round.ends }, (_, i) => i) }
      : {}),
    createdAt: now,
    updatedAt: now,
    notes: '',
    shaftDiameterMm: 6,
    ends: Array.from({ length: round.ends }, () => ({
      arrows: Array.from({ length: round.arrowsPerEnd }, () => null),
      committed: false,
    })),
  }
}

export function endStats(end: End, round: RoundDefinition) {
  const arrows = end.arrows.filter((a): a is Arrow => a !== null)
  return {
    count: arrows.length,
    total: end.arrows.reduce(
      (sum, a, i) => sum + (a ? round.points(a.score, i) : 0),
      0
    ),
    xs: arrows.filter((a) => a.score === 'X').length,
  }
}

export function sessionStats(session: Session) {
  const round = sessionRound(session)
  const stats = session.ends.map((end) => endStats(end, round))
  const total = stats.reduce((sum, s) => sum + s.total, 0)
  const count = stats.reduce((sum, s) => sum + s.count, 0)
  const completedEnds = session.ends.filter((e) => e.committed).length
  return {
    total,
    count,
    xs: stats.reduce((sum, s) => sum + s.xs, 0),
    average: count ? total / count : 0,
    completedEnds,
    complete: completedEnds === round.ends,
    max: round.ends * round.arrowsPerEnd * round.maxArrowScore,
  }
}

export function firstOpenEnd(session: Session) {
  const index = session.ends.findIndex((e) => !e.committed)
  return index < 0 ? session.ends.length - 1 : index
}

export function withArrow(
  session: Session,
  endIndex: number,
  arrowIndex: number,
  arrow: Arrow | null
): Session {
  const next = structuredClone(session)
  const end = next.ends[endIndex]
  if (!end || arrowIndex < 0 || arrowIndex >= end.arrows.length)
    throw new Error('Invalid arrow slot')
  end.arrows[arrowIndex] = arrow
  if (!arrow) end.committed = false
  next.updatedAt = new Date().toISOString()
  return next
}
