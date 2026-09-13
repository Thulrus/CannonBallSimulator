export interface ProjectileShape {
  id: string
  name: string
  /** Representative drag coefficient. */
  dragCoefficient: number
  description: string
}

/**
 * Flat Cd values. Real drag varies strongly with Mach number (the transonic spike
 * roughly doubles it) — G1/G7 tables are listed as a stretch goal in the spec.
 */
export const PROJECTILE_SHAPES: ProjectileShape[] = [
  {
    id: 'sphere',
    name: 'Sphere (round shot)',
    dragCoefficient: 0.47,
    description: 'Classic cannonball.',
  },
  {
    id: 'flatNose',
    name: 'Flat-nose cylinder',
    dragCoefficient: 0.82,
    description: 'Blunt slug; very draggy.',
  },
  {
    id: 'ogive',
    name: 'Ogive shell',
    dragCoefficient: 0.3,
    description: 'Pointed artillery shell.',
  },
  {
    id: 'boatTail',
    name: 'Boat-tail ogive',
    dragCoefficient: 0.22,
    description: 'Tapered base cuts base drag.',
  },
  { id: 'custom', name: 'Custom', dragCoefficient: 0.47, description: 'Set Cd by hand.' },
]

export const shapeForCd = (cd: number): string =>
  PROJECTILE_SHAPES.find((s) => s.id !== 'custom' && Math.abs(s.dragCoefficient - cd) < 1e-9)?.id ??
  'custom'
