export type Score = 'X' | 'M' | `${number}`
export interface Position {
  x: number
  y: number
}
export interface Arrow {
  score: Score
  position?: Position
}
export interface End {
  arrows: (Arrow | null)[]
  committed: boolean
}
export interface Session {
  targetFace?: TargetFaceId
  customConfig?: CustomConfig
  fieldOrder?: number[]
  id: string
  roundId: string
  createdAt: string
  updatedAt: string
  notes: string
  shaftDiameterMm: number
  ends: End[]
}
export interface TargetRing {
  radius: number
  score: Score
  fill: string
  stroke: string
}
export interface RoundDefinition {
  targetFace?: TargetFace
  customConfig?: CustomConfig
  stations?: Station[]
  id: string
  name: string
  family: 'indoor' | 'field' | 'hunter' | 'animal' | 'custom'
  ends: number
  arrowsPerEnd: number
  maxArrowScore: number
  distance: string
  targetDiameterCm: number
  scores: readonly Score[]
  rings: readonly TargetRing[]
  points: (score: Score, arrowIndex?: number) => number
  scorePosition: (position: Position, shaftDiameterMm: number) => Score
}

export type TargetFaceId = 'single' | 'five-spot' | 'four-face'
export interface TargetFace {
  id: TargetFaceId
  label: string
  centers: Position[]
  radius: number
  boardDiameterCm: number
}

export interface Station {
  distance: string
  targetDiameterCm: number
  instruction: string
}
export interface CustomConfig {
  id: string
  name: string
  ends: number
  arrowsPerEnd: number
  distance: number
  unit: 'yards' | 'meters' | 'feet'
  targetDiameterCm: number
  face: 'indoor' | 'field' | 'rings'
  maxScore: number
  useX: boolean
}
