/** @typedef {{ id: string, icon: string, label: string, description: string, rain: number, water: number, autoRise: boolean }} ScenarioDef */

/** @type {ScenarioDef[]} */
export const SCENARIOS = [
  {
    id: 'drizzle',
    icon: '🌧',
    label: '소나기',
    description: '가볍게 비가 올 때',
    rain: 40,
    water: 0,
    autoRise: true,
  },
  {
    id: 'heavy_rain',
    icon: '⛈',
    label: '집중호우',
    description: '시간당 135mm 기준',
    rain: 75,
    water: 3.5,
    autoRise: true,
  },
  {
    id: 'gangnam_2022',
    icon: '🚇',
    label: '2022 강남역',
    description: '실제 침수 참고값 (교육용) · 침수흔적 overlay',
    rain: 85,
    water: 8.5,
    autoRise: false,
  },
  {
    id: 'typhoon',
    icon: '🌀',
    label: '태풍급',
    description: '최대 강수 + 급격한 상승',
    rain: 100,
    water: 15,
    autoRise: true,
  },
]
