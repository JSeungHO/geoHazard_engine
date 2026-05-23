export const DEFAULT_SIMULATION_OPTIONS = {
  waterRiseSpeed: 0.24,
  waveTimeScale: 0.32,
  waveStiffness: 0.16,
  waveMaxAmplitude: 4.2,
  rainImpactStrength: 0.03,
  glintStrength: 0.78,
  reflectivity: 0.48,
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
