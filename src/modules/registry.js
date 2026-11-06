import { Activity, Waves } from 'lucide-react'
import FloodModule from './flood/FloodModule'
import EarthquakeModule from './earthquake/EarthquakeModule'

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   icon: React.ComponentType,
 *   component: React.ComponentType | null,
 *   available: boolean,
 *   description?: string,
 * }} ModuleDef
 */

/** @type {ModuleDef[]} */
export const MODULE_REGISTRY = [
  {
    id: 'flood',
    label: '도시 침수',
    icon: Waves,
    description: '강수·수위에 따른 저지대 침수 범위',
    component: FloodModule,
    available: true,
  },
  {
    id: 'earthquake',
    label: '지진동',
    icon: Activity,
    description: '지진파 전파와 진도(MMI) 분포',
    component: EarthquakeModule,
    available: true,
  },
]

export const DEFAULT_MODULE_ID = 'flood'

export function getModuleById(id) {
  return MODULE_REGISTRY.find((module) => module.id === id) ?? MODULE_REGISTRY[0]
}
