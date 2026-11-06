import { useEffect, useRef } from 'react'
import { FLOOD_TIME_SCALE, stepPondingDepth } from '../../../physics/UrbanPondingModel'

const TICK_MS = 50

const roundWaterLevel = (value) => Math.round(value * 10_000) / 10_000

/**
 * 토글이 켜진 동안 강우-배수 저류 모델(UrbanPondingModel)로 침수 깊이를 갱신한다.
 * 실제 1초 = 시뮬레이션 FLOOD_TIME_SCALE초.
 *
 * @param {boolean} enabled
 * @param {number} rainfallMmH 강우 강도 (mm/h)
 * @param {{ runoffCoefficient: number, drainageCapacityMmH: number }} params
 * @param {(updater: (prev: number) => number) => void} setWaterLevel
 */
export default function useRainWaterAccumulation(enabled, rainfallMmH, params, setWaterLevel) {
  const stateRef = useRef({ enabled, rainfallMmH, params, setWaterLevel })

  useEffect(() => {
    stateRef.current = { enabled, rainfallMmH, params, setWaterLevel }
  }, [enabled, rainfallMmH, params, setWaterLevel])

  useEffect(() => {
    // 타이머 지연(무거운 렌더링·백그라운드 탭)과 무관하도록 실제 경과 시간으로 적분한다.
    let lastMs = performance.now()

    const intervalId = window.setInterval(() => {
      const now = performance.now()
      const realSeconds = Math.min((now - lastMs) / 1000, 1)
      lastMs = now

      const current = stateRef.current
      if (!current.enabled) return

      const simSeconds = realSeconds * FLOOD_TIME_SCALE
      current.setWaterLevel((prev) => {
        const next = roundWaterLevel(
          stepPondingDepth(prev, current.rainfallMmH, simSeconds, current.params),
        )
        return next === prev ? prev : next
      })
    }, TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [])
}
