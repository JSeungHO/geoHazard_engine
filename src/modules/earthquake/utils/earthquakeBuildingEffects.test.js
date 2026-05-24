import { describe, it, expect } from 'vitest'
import { Cesium3DTileStyle } from 'cesium'
import {
  getBuildingStyleRefreshKey,
  getBuildingShakeIntensity,
  buildBuildingDamageStyle,
  DEFAULT_BUILDING_STYLE,
} from './earthquakeBuildingEffects'

const EPICENTER = { lat: 35.76, lon: 129.19 }

describe('getBuildingStyleRefreshKey', () => {
  it('같은 bucket이면 동일 키', () => {
    expect(getBuildingStyleRefreshKey(120_000, 5.8, 15))
      .toBe(getBuildingStyleRefreshKey(149_000, 5.8, 15))
  })

  it('규모 변경 시 다른 키', () => {
    const a = getBuildingStyleRefreshKey(120_000, 5.8, 15)
    const b = getBuildingStyleRefreshKey(120_000, 6.0, 15)
    expect(a).not.toBe(b)
  })
})

describe('getBuildingShakeIntensity', () => {
  it('idle → 0', () => {
    expect(getBuildingShakeIntensity({ simState: 'idle', maxMMI: 8, sWaveRadiusM: 100_000 })).toBe(0)
  })

  it('paused → 0', () => {
    expect(getBuildingShakeIntensity({ simState: 'paused', maxMMI: 8, sWaveRadiusM: 100_000 })).toBe(0)
  })

  it('running + MMI 5+ → 양수', () => {
    const v = getBuildingShakeIntensity({ simState: 'running', maxMMI: 7, sWaveRadiusM: 200_000 })
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThanOrEqual(0.22)
  })

  it('MMI 4 이하 → 0', () => {
    expect(getBuildingShakeIntensity({ simState: 'running', maxMMI: 4, sWaveRadiusM: 200_000 })).toBe(0)
  })
})

describe('buildBuildingDamageStyle', () => {
  it('Cesium3DTileStyle 인스턴스 반환', () => {
    const style = buildBuildingDamageStyle(EPICENTER, 120)
    expect(style).toBeInstanceOf(Cesium3DTileStyle)
    expect(style.color).toBeTruthy()
  })
})

describe('DEFAULT_BUILDING_STYLE', () => {
  it('Cesium3DTileStyle 인스턴스', () => {
    expect(DEFAULT_BUILDING_STYLE).toBeInstanceOf(Cesium3DTileStyle)
  })
})
