import type { PropellantType } from '../physics/ballistics'

export const PROPELLANTS: PropellantType[] = [
  {
    id: 'blackPowder',
    name: 'Black powder',
    energyDensity: 3.0e6,
    description: 'Charcoal, sulfur and saltpetre. Smoky, low energy, used until the 1880s.',
  },
  {
    id: 'cordite',
    name: 'Cordite',
    energyDensity: 4.0e6,
    description: 'Double-base smokeless propellant, standard British charge 1890–1945.',
  },
  {
    id: 'smokeless',
    name: 'Smokeless (single-base)',
    energyDensity: 4.5e6,
    description: 'Nitrocellulose powder, the modern artillery default.',
  },
  {
    id: 'tripleBase',
    name: 'Triple-base (M30)',
    energyDensity: 4.9e6,
    description: 'Adds nitroguanidine for cooler burning and less barrel erosion.',
  },
]

export const propellantById = (id: string): PropellantType =>
  PROPELLANTS.find((p) => p.id === id) ?? PROPELLANTS[0]
