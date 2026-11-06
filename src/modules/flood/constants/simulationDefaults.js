export const DEFAULT_SIMULATION_OPTIONS = {
  waveTimeScale: 0.32,
  waveStiffness: 0.16,
  waveMaxAmplitude: 0.3,
  rainImpactStrength: 0.03,
  glintStrength: 0.78,
  reflectivity: 0.48,
}

/** 수면 표현 프리셋 — 시각 효과 전용 (수위 계산과 무관) */
export const WAVE_PRESETS = [
  {
    id: 'calm',
    label: '잔잔',
    description: '잔잔한 수면',
    values: {
      waveTimeScale: 0.12,
      waveStiffness: 0.08,
      waveMaxAmplitude: 0.1,
      rainImpactStrength: 0.01,
      glintStrength: 0.35,
      reflectivity: 0.65,
    },
  },
  {
    id: 'normal',
    label: '보통',
    description: '기본값',
    values: { ...DEFAULT_SIMULATION_OPTIONS },
  },
  {
    id: 'storm',
    label: '폭풍',
    description: '거친 파도',
    values: {
      waveTimeScale: 0.75,
      waveStiffness: 0.35,
      waveMaxAmplitude: 0.6,
      rainImpactStrength: 0.12,
      glintStrength: 1.8,
      reflectivity: 0.3,
    },
  },
]

const PRESET_OPTION_KEYS = Object.keys(DEFAULT_SIMULATION_OPTIONS)

export function matchesSimulationPreset(options, presetValues) {
  return PRESET_OPTION_KEYS.every(
    (key) => Math.abs(options[key] - presetValues[key]) < 1e-4
  )
}

export function findActivePresetId(options) {
  const match = WAVE_PRESETS.find((preset) => matchesSimulationPreset(options, preset.values))
  return match?.id ?? null
}

export const SIMULATION_OPTION_RANGES = {
  waveTimeScale: { min: 0.1, max: 1.0, step: 0.01, unit: '×' },
  waveStiffness: { min: 0.05, max: 0.4, step: 0.01, unit: '' },
  waveMaxAmplitude: { min: 0.05, max: 1, step: 0.05, unit: 'm' },
  rainImpactStrength: { min: 0.01, max: 0.15, step: 0.01, unit: '' },
  glintStrength: { min: 0, max: 2.5, step: 0.05, unit: '×' },
  reflectivity: { min: 0.2, max: 1.0, step: 0.01, unit: '' },
}

/** 배수 모델 파라미터 슬라이더 범위 — physics/UrbanPondingModel 참조 */
export const PONDING_PARAM_RANGES = {
  drainageCapacityMmH: { min: 20, max: 120, step: 5 },
  runoffCoefficient: { min: 0.5, max: 1.0, step: 0.05 },
}
