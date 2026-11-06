/**
 * 침수 시나리오 프리셋
 * rain: 강우 강도 (mm/h) · water: 시작 침수 깊이 (m) · autoRise: 강우-배수 모델로 수위 자동 계산
 *
 * @typedef {{ id: string, label: string, description: string, rain: number, water: number, autoRise: boolean }} ScenarioDef
 */

/** @type {ScenarioDef[]} */
export const SCENARIOS = [
  {
    id: 'drizzle',
    label: '보통 비',
    description: '배수능 이내 — 침수 없음',
    rain: 30,
    water: 0,
    autoRise: true,
  },
  {
    id: 'heavy_rain',
    label: '집중호우',
    description: '시간당 80 mm — 배수능 초과',
    rain: 80,
    water: 0,
    autoRise: true,
  },
  {
    id: 'gangnam_2022',
    label: '2022 강남역 호우',
    description: '2022.8.8 실측 최대 침수심 · 침수흔적도 표시',
    rain: 116,
    water: 1.8,
    autoRise: false,
  },
  {
    id: 'extreme',
    label: '극한 호우',
    description: '시간당 150 mm — 2022년 관측 최대 초과',
    rain: 150,
    water: 0,
    autoRise: true,
  },
]
