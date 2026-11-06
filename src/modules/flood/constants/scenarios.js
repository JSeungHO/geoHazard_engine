/** @typedef {{ id: string, label: string, description: string, rain: number, water: number, autoRise: boolean }} ScenarioDef */

/** @type {ScenarioDef[]} */
export const SCENARIOS = [
  {
    id: 'drizzle',
    label: '소나기',
    description: '약한 강우 · 수위 자동 상승',
    rain: 40,
    water: 0,
    autoRise: true,
  },
  {
    id: 'heavy_rain',
    label: '집중호우',
    description: '시간당 135 mm급 집중호우',
    rain: 75,
    water: 3.5,
    autoRise: true,
  },
  {
    id: 'gangnam_2022',
    label: '2022 강남역 호우',
    description: '2022.8.8 호우 · 서울시 침수흔적도 표시',
    rain: 85,
    water: 8.5,
    autoRise: false,
  },
  {
    id: 'typhoon',
    label: '태풍급',
    description: '최대 강우 · 급격한 수위 상승',
    rain: 100,
    water: 15,
    autoRise: true,
  },
]
