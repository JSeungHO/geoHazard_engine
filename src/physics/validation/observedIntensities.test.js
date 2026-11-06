/**
 * 관측 진도 대비 EarthquakeWaveModel 검증.
 * 판정 기준: 모델 진도를 반올림한 등급이 관측 등급과 같으면 일치.
 *
 * it.fails — 현재 모델이 맞히지 못하는 "알려진 오차". 계수·식을 개선해 이 항목이 맞게 되면
 * 테스트가 실패하므로, 그때 it.fails 를 it 로 바꾸고 docs/model.md 표를 갱신한다.
 */
import { describe, expect, it } from 'vitest'
import { EarthquakeWaveModel } from '../EarthquakeWaveModel.js'
import { OBSERVED_INTENSITIES } from './observedIntensities.js'
import { EPICENTER_PRESETS } from '../../modules/earthquake/constants/earthquakePresets.js'
import { EARTHQUAKE_IMPACT_CITIES } from '../../modules/earthquake/constants/earthquakeImpactCities.js'

const modelFor = (eventId) => {
  const preset = EPICENTER_PRESETS.find((p) => p.id === eventId)
  return new EarthquakeWaveModel({
    epicenter: preset,
    depthKm: preset.depthKm,
    magnitude: preset.magnitude,
  })
}

const mmiAt = (eventId, cityId) => {
  const city = EARTHQUAKE_IMPACT_CITIES.find((c) => c.id === cityId)
  return modelFor(eventId).getMMI(city.lat, city.lon)
}

const KNOWN_MISSES = new Set(['gyeongju_2016:daegu', 'gyeongju_2016:seoul', 'pohang_2017:pohang'])

describe('관측 진도 검증', () => {
  for (const event of OBSERVED_INTENSITIES) {
    it(`${event.label} 프리셋 규모가 기상청 ML과 같다`, () => {
      expect(EPICENTER_PRESETS.find((p) => p.id === event.eventId).magnitude).toBe(event.ml)
    })

    for (const obs of event.observations) {
      const key = `${event.eventId}:${obs.cityId}`
      const run = KNOWN_MISSES.has(key) ? it.fails : it
      const expected = obs.mmi != null ? `MMI ${obs.mmi}` : `MMI ≥ ${obs.minMmi}`

      run(`${event.label} · ${obs.cityId} → ${expected}`, () => {
        const model = Math.round(mmiAt(event.eventId, obs.cityId))
        if (obs.mmi != null) expect(model).toBe(obs.mmi)
        else expect(model).toBeGreaterThanOrEqual(obs.minMmi)
      })
    }
  }
})
