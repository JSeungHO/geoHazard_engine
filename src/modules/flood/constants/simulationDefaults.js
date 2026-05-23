export const DEFAULT_SIMULATION_OPTIONS = {
  waterRiseSpeed: 0.24,
  waveTimeScale: 0.32,
  waveStiffness: 0.16,
  waveMaxAmplitude: 4.2,
  rainImpactStrength: 0.03,
  glintStrength: 0.78,
  reflectivity: 0.48,
}

export const WAVE_PRESETS = [
  {
    id: 'calm',
    label: '잔잔',
    description: '잔잔한 수면',
    values: {
      waterRiseSpeed: 0.12,
      waveTimeScale: 0.12,
      waveStiffness: 0.08,
      waveMaxAmplitude: 1.8,
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
      waterRiseSpeed: 0.6,
      waveTimeScale: 0.75,
      waveStiffness: 0.35,
      waveMaxAmplitude: 8.0,
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
  waterRiseSpeed: { min: 0.05, max: 0.8, step: 0.01, unit: 'm/s' },
  waveTimeScale: { min: 0.1, max: 1.0, step: 0.01, unit: '×' },
  waveStiffness: { min: 0.05, max: 0.4, step: 0.01, unit: '' },
  waveMaxAmplitude: { min: 1, max: 8, step: 0.1, unit: 'm' },
  rainImpactStrength: { min: 0.01, max: 0.15, step: 0.01, unit: '' },
  glintStrength: { min: 0, max: 2.5, step: 0.05, unit: '×' },
  reflectivity: { min: 0.2, max: 1.0, step: 0.01, unit: '' },
}
