/**
 * 지진 진원 프리셋 — 한반도 주요 단층대·역사 지진
 * 참조: earthquake-plan.md §4
 */

export const EPICENTER_PRESETS = [
  {
    id: 'gyeongju_2016',
    label: '경주 (2016)',
    lat: 35.76,
    lon: 129.19,
    depthKm: 15,
    magnitude: 5.8,
    description: '양산단층 — 한국 계기 지진 최대',
  },
  {
    id: 'pohang_2017',
    label: '포항 (2017)',
    lat: 36.11,
    lon: 129.36,
    depthKm: 7,
    magnitude: 5.4,
    description: '북구 북쪽 촉발 지진',
  },
  {
    id: 'yangsan_fault',
    label: '양산단층 (가상)',
    lat: 35.50,
    lon: 129.15,
    depthKm: 12,
    magnitude: 6.5,
    description: '한반도 최대 활단층 가상 시나리오',
  },
  {
    id: 'west_sea',
    label: '서해 해역 (가상)',
    lat: 36.0,
    lon: 124.5,
    depthKm: 20,
    magnitude: 6.0,
    description: '서해 해역 가상 시나리오',
  },
  {
    id: 'east_sea',
    label: '동해 해역 (가상)',
    lat: 37.5,
    lon: 131.5,
    depthKm: 25,
    magnitude: 6.8,
    description: '동해 해역 가상 시나리오',
  },
]

export const DEFAULT_EPICENTER = EPICENTER_PRESETS[0]

export const DEFAULT_EARTHQUAKE_OPTIONS = {
  depthKm: 15,
  magnitude: 5.8,
  timeScale: 50,
  maxPropagationKm: 800,
  aftershocksEnabled: true,
}

/** 지진 탭 기본 조망 — 진앙(경주) 중심, 한반도 전체가 보이는 고도·각도 */
export const EARTHQUAKE_DEFAULT_VIEW = {
  lat: 36.0,
  lon: 128.4,
  cameraHeight: 820_000,
  cameraOrientation: {
    heading: 0,
    pitch: -1.05,
    roll: 0,
  },
}

/** idle 조망 range (m) — maxPropagation 대비 약간 줌인 */
export const EARTHQUAKE_IDLE_VIEW_RANGE_FACTOR = 0.72
