export const DEFAULT_TSUNAMI_OPTIONS = {
  waveSpeed: 200,
  timeScale: 100,
  maxWaveHeight: 12,
  maxPropagationKm: 500,
}

export const EPICENTER_PRESETS = [
  { id: 'east_sea', label: '동해 근해', lat: 36.5, lon: 129.5, region: 'east' },
  { id: 'yellow_sea', label: '서해', lat: 36.5, lon: 124.0, region: 'west' },
  { id: 'japan_west', label: '일본 서부', lat: 36.0, lon: 132.0, region: 'south' },
]

export const DEFAULT_EPICENTER = EPICENTER_PRESETS[0]
