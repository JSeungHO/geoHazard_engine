import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SIMULATION_OPTIONS,
  WAVE_PRESETS,
  findActivePresetId,
  matchesSimulationPreset,
} from './simulationDefaults.js'

describe('simulation presets', () => {
  it('matches exact preset values', () => {
    const normal = WAVE_PRESETS.find((p) => p.id === 'normal')
    expect(matchesSimulationPreset(DEFAULT_SIMULATION_OPTIONS, normal.values)).toBe(true)
  })

  it('findActivePresetId returns normal for defaults', () => {
    expect(findActivePresetId(DEFAULT_SIMULATION_OPTIONS)).toBe('normal')
  })

  it('findActivePresetId returns null for custom values', () => {
    expect(
      findActivePresetId({ ...DEFAULT_SIMULATION_OPTIONS, waveTimeScale: 0.5 })
    ).toBe(null)
  })
})
