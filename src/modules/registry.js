import FloodModule from './flood/FloodModule'

/** @typedef {{ id: string, label: string, component: React.ComponentType | null, available: boolean, description?: string }} ModuleDef */

/** @type {ModuleDef[]} */
export const MODULE_REGISTRY = [
  {
    id: 'flood',
    label: '홍수·침수',
    description: '강수·수위 시뮬레이션',
    component: FloodModule,
    available: true,
  },
  {
    id: 'tsunami',
    label: '쓰나미',
    description: '준비 중',
    component: null,
    available: false,
  },
  {
    id: 'earthquake',
    label: '지진',
    description: '준비 중',
    component: null,
    available: false,
  },
]

export const DEFAULT_MODULE_ID = 'flood'

export function getModuleById(id) {
  return MODULE_REGISTRY.find((module) => module.id === id) ?? MODULE_REGISTRY[0]
}
