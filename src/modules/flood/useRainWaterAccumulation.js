import { useEffect, useRef } from 'react'

const WATER_LEVEL_MAX = 100

const roundWaterLevel = (value) => Math.round(value * 100) / 100

/**
 * 토글이 켜진 동안 강수량에 비례해 수위를 자동 증가.
 * viewer/Cesium과 무관 — FloodModule state만 갱신.
 */
export default function useRainWaterAccumulation(
  enabled,
  rainIntensity,
  waterRiseSpeed,
  setWaterLevel
) {
  const rainIntensityRef = useRef(rainIntensity)
  const waterRiseSpeedRef = useRef(waterRiseSpeed)

  useEffect(() => {
    rainIntensityRef.current = rainIntensity
    waterRiseSpeedRef.current = waterRiseSpeed
  }, [rainIntensity, waterRiseSpeed])

  useEffect(() => {
    if (!enabled) return undefined

    let frameId = 0
    let lastMs = performance.now()

    const tick = (now) => {
      const dt = Math.min((now - lastMs) / 1000, 0.1)
      lastMs = now

      const intensity = rainIntensityRef.current
      if (intensity > 0) {
        const rise = waterRiseSpeedRef.current * (intensity / 100) * dt
        setWaterLevel((prev) => {
          if (prev >= WATER_LEVEL_MAX) return prev
          return roundWaterLevel(Math.min(WATER_LEVEL_MAX, prev + rise))
        })
      }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frameId)
  }, [enabled, setWaterLevel])
}
