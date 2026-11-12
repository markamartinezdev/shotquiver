import type {
  Position,
  RoundDefinition,
  Score,
  TargetRing,
  Station,
  CustomConfig,
  Session,
  TargetFaceId,
} from './types'

// Radii are fractions of the 20 cm face radius, ordered from center outward.
// NFAA Constitution & By-Laws, Article VI.E (verified November 11, 2026).
export const indoorRings: readonly TargetRing[] = [
  { radius: 0.1, score: 'X', fill: '#fafbf5', stroke: '#426a93' },
  { radius: 0.2, score: '5', fill: '#fafbf5', stroke: '#fafbf5' },
  { radius: 0.4, score: '4', fill: '#426a93', stroke: '#fafbf5' },
  { radius: 0.6, score: '3', fill: '#426a93', stroke: '#fafbf5' },
  { radius: 0.8, score: '2', fill: '#426a93', stroke: '#fafbf5' },
  { radius: 1, score: '1', fill: '#426a93', stroke: '#fafbf5' },
]

export function indoorScorePosition(
  { x, y }: Position,
  shaftDiameterMm = 0
): Score {
  // Arrow-center distance minus shaft radius implements the higher-value line call.
  const innerEdge = Math.hypot(x, y) - shaftDiameterMm / 400
  return (
    indoorRings.find((ring) => innerEdge <= ring.radius + 1e-9)?.score ?? 'M'
  )
}

export const indoor300: RoundDefinition = {
  id: 'nfaa-indoor-300',
  name: 'NFAA Indoor 300',
  family: 'indoor',
  ends: 12,
  arrowsPerEnd: 5,
  maxArrowScore: 5,
  distance: '20 yards',
  targetDiameterCm: 40,
  scores: ['X', '5', '4', '3', '2', '1', 'M'],
  rings: indoorRings,
  points: (score) => (score === 'X' ? 5 : score === 'M' ? 0 : Number(score)),
  scorePosition: indoorScorePosition,
}

// Register new definitions here. Field/Hunter can supply stake/target metadata;
// Animal can implement arrow-dependent scoring in its own strategy.
export const rounds: Record<string, RoundDefinition> = {
  [indoor300.id]: indoor300,
}
export const futureRounds = ['NFAA Hunter', 'NFAA Animal']

export const fieldRings: readonly TargetRing[] = [
  { radius: 0.1, score: 'X', fill: '#242424', stroke: '#fafbf5' },
  { radius: 0.2, score: '5', fill: '#242424', stroke: '#fafbf5' },
  { radius: 0.4, score: '4', fill: '#fafbf5', stroke: '#242424' },
  { radius: 0.6, score: '4', fill: '#fafbf5', stroke: '#242424' },
  { radius: 0.8, score: '3', fill: '#242424', stroke: '#fafbf5' },
  { radius: 1, score: '3', fill: '#242424', stroke: '#fafbf5' },
]
export function radialScore(
  rings: readonly TargetRing[],
  diameter: number,
  p: Position,
  shaft: number
): Score {
  const edge = Math.hypot(p.x, p.y) - shaft / (diameter * 10)
  return rings.find((r) => edge <= r.radius + 1e-9)?.score ?? 'M'
}
export const fieldStations: Station[] = [
  ...[15, 20, 25, 30, 40, 45, 50, 55, 60, 65].map((d) => ({
    distance: `${d} yards`,
    targetDiameterCm: d <= 30 ? 35 : d <= 50 ? 50 : 65,
    instruction: 'Four arrows from one stake.',
  })),
  {
    distance: '35 yards',
    targetDiameterCm: 50,
    instruction:
      'Fan: one arrow from each of four positions (or designated separate faces).',
  },
  {
    distance: '45 / 40 / 35 / 30 yards',
    targetDiameterCm: 50,
    instruction: 'Walk-up: one arrow at each distance, longest first.',
  },
  {
    distance: '80 / 70 / 60 / 50 yards',
    targetDiameterCm: 65,
    instruction: 'Walk-up: one arrow at each distance, longest first.',
  },
  {
    distance: '35 / 30 / 25 / 20 feet',
    targetDiameterCm: 20,
    instruction: 'Walk-up: one arrow at each distance, longest first.',
  },
]
for (const ends of [28, 14])
  for (const pro of [false, true]) {
    const id = `nfaa-field-${ends}${pro ? '-pro' : ''}`
    rounds[id] = {
      id,
      name: `NFAA Field ${ends === 14 ? '14-target practice' : '28-target round'}${pro ? ' · Pro' : ''}`,
      family: 'field',
      ends,
      arrowsPerEnd: 4,
      maxArrowScore: pro ? 6 : 5,
      distance: 'Adult marked distances',
      targetDiameterCm: 35,
      scores: ['X', '5', '4', '3', 'M'],
      rings: fieldRings,
      stations: Array.from({ length: ends }, (_, i) => fieldStations[i % 14]),
      points: (s) => (s === 'X' ? (pro ? 6 : 5) : s === 'M' ? 0 : Number(s)),
      scorePosition: (p, shaft) => radialScore(fieldRings, 35, p, shaft),
    }
  }

export function validateCustom(value: unknown): CustomConfig {
  if (!value || typeof value !== 'object')
    throw new Error('Missing custom round settings.')
  const c = value as CustomConfig
  if (
    typeof c.id !== 'string' ||
    !c.id ||
    c.id.length > 100 ||
    typeof c.name !== 'string' ||
    !c.name.trim() ||
    c.name.length > 60 ||
    !Number.isInteger(c.ends) ||
    c.ends < 1 ||
    c.ends > 100 ||
    !Number.isInteger(c.arrowsPerEnd) ||
    c.arrowsPerEnd < 1 ||
    c.arrowsPerEnd > 12 ||
    !Number.isFinite(c.distance) ||
    c.distance <= 0 ||
    c.distance > 1000 ||
    !['yards', 'meters', 'feet'].includes(c.unit) ||
    !Number.isFinite(c.targetDiameterCm) ||
    c.targetDiameterCm < 10 ||
    c.targetDiameterCm > 200 ||
    !['indoor', 'field', 'rings'].includes(c.face) ||
    !Number.isInteger(c.maxScore) ||
    c.maxScore < 1 ||
    c.maxScore > 10 ||
    typeof c.useX !== 'boolean' ||
    (c.face !== 'rings' && (c.maxScore !== 5 || !c.useX))
  )
    throw new Error('Invalid custom round settings. Check the field limits.')
  return {
    id: c.id,
    name: c.name.trim(),
    ends: c.ends,
    arrowsPerEnd: c.arrowsPerEnd,
    distance: c.distance,
    unit: c.unit,
    targetDiameterCm: c.targetDiameterCm,
    face: c.face,
    maxScore: c.maxScore,
    useX: c.useX,
  }
}
export function customRound(value: CustomConfig): RoundDefinition {
  const c = validateCustom(value)
  const rings: readonly TargetRing[] =
    c.face === 'indoor'
      ? indoorRings
      : c.face === 'field'
        ? fieldRings
        : [
            ...(c.useX
              ? [
                  {
                    radius: 0.5 / c.maxScore,
                    score: 'X' as Score,
                    fill: '#fafbf5',
                    stroke: '#426a93',
                  },
                ]
              : []),
            ...Array.from({ length: c.maxScore }, (_, i) => ({
              radius: (i + 1) / c.maxScore,
              score: String(c.maxScore - i) as Score,
              fill: i === 0 ? '#fafbf5' : '#426a93',
              stroke: i === 0 ? '#426a93' : '#fafbf5',
            })),
          ]
  return {
    id: `custom:${c.id}`,
    name: c.name,
    family: 'custom',
    customConfig: c,
    ends: c.ends,
    arrowsPerEnd: c.arrowsPerEnd,
    maxArrowScore: c.maxScore,
    distance: `${c.distance} ${c.unit}`,
    targetDiameterCm: c.targetDiameterCm,
    rings,
    scores: [...new Set(rings.map((r) => r.score)), 'M'],
    points: (s) => (s === 'X' ? c.maxScore : s === 'M' ? 0 : Number(s)),
    scorePosition: (p, shaft) =>
      radialScore(rings, c.targetDiameterCm, p, shaft),
  }
}
export function sessionRound(session: Session): RoundDefinition {
  if (session.roundId === 'custom')
    return withTargetFace(
      customRound(session.customConfig!),
      session.targetFace ?? 'single'
    )
  if (!Object.hasOwn(rounds, session.roundId))
    throw new Error('Unsupported round.')
  return withTargetFace(rounds[session.roundId], session.targetFace ?? 'single')
}
export function endRound(session: Session, index: number): RoundDefinition {
  const base = sessionRound(session)
  if (!base.stations) return base
  const station = base.stations[session.fieldOrder?.[index] ?? index]
  return withTargetFace(
    {
      ...base,
      distance: station.distance,
      targetDiameterCm: station.targetDiameterCm,
      scorePosition: (p, shaft) =>
        radialScore(base.rings, station.targetDiameterCm, p, shaft),
    },
    session.targetFace ?? 'single'
  )
}

export function targetFaceOptions(
  round: RoundDefinition
): { id: TargetFaceId; label: string }[] {
  const pattern =
    round.family === 'custom' ? round.customConfig?.face : round.family
  return [
    {
      id: 'single',
      label: pattern === 'field' ? 'Single Field face' : 'Single spot',
    },
    ...(pattern === 'indoor'
      ? [
          {
            id: 'five-spot' as const,
            label:
              round.family === 'custom'
                ? 'Five spot (scaled Indoor pattern)'
                : 'NFAA five spot',
          },
        ]
      : []),
    ...(pattern === 'field'
      ? [{ id: 'four-face' as const, label: 'Four full Field faces' }]
      : []),
  ]
}

export function withTargetFace(
  round: RoundDefinition,
  id: TargetFaceId
): RoundDefinition {
  const option = targetFaceOptions(round).find((option) => option.id === id)
  if (!option)
    throw new Error('This target face is not supported by the round.')
  // Rebuild the underlying pattern when switching from a cropped five-spot face.
  const pattern =
    round.family === 'custom' ? round.customConfig?.face : round.family
  const baseRings =
    pattern === 'indoor'
      ? indoorRings
      : pattern === 'field'
        ? fieldRings
        : round.rings
  const rings: readonly TargetRing[] =
    id === 'five-spot'
      ? [
          { radius: 0.25, score: 'X', fill: '#fafbf5', stroke: '#426a93' },
          { radius: 0.5, score: '5', fill: '#fafbf5', stroke: '#fafbf5' },
          { radius: 0.75, score: '4', fill: '#426a93', stroke: '#fafbf5' },
          { radius: 1, score: '4', fill: '#426a93', stroke: '#fafbf5' },
        ]
      : baseRings
  const radius = id === 'five-spot' ? 0.4 : id === 'four-face' ? 0.5 : 1
  const centers =
    id === 'five-spot'
      ? [
          { x: -0.6, y: -0.6 },
          { x: 0.6, y: -0.6 },
          { x: 0, y: 0 },
          { x: -0.6, y: 0.6 },
          { x: 0.6, y: 0.6 },
        ]
      : id === 'four-face'
        ? [
            { x: -0.5, y: -0.5 },
            { x: 0.5, y: -0.5 },
            { x: -0.5, y: 0.5 },
            { x: 0.5, y: 0.5 },
          ]
        : [{ x: 0, y: 0 }]
  const boardDiameterCm = round.targetDiameterCm * (id === 'four-face' ? 2 : 1)
  return {
    ...round,
    rings,
    scores: [...new Set(rings.map((r) => r.score)), 'M'],
    targetFace: { id, label: option.label, centers, radius, boardDiameterCm },
    scorePosition: (p, shaft) => {
      const nearest = centers.reduce((a, b) =>
        Math.hypot(p.x - a.x, p.y - a.y) <= Math.hypot(p.x - b.x, p.y - b.y)
          ? a
          : b
      )
      return radialScore(
        rings,
        boardDiameterCm * radius,
        { x: (p.x - nearest.x) / radius, y: (p.y - nearest.y) / radius },
        shaft
      )
    },
  }
}
