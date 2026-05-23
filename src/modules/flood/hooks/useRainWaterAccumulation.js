import { useEffect, useRef } from 'react'

const WATER_LEVEL_MAX = 100
const TICK_MS = 50
const DRAINAGE_RAIN_THRESHOLD = 10
const DRAINAGE_RATE = 0.08

const roundWaterLevel = (value) => Math.round(value * 100) / 100

/**
 * 토글이 켜진 동안 강수량에 비례해 침수 깊이(m)를 자동 증가.
 * 강수가 임계값 미만이면 천천히 감소(drainage).
 */
export default function useRainWaterAccumulation(
  enabled,
  rainIntensity,
  waterRiseSpeed,
  setWaterLevel
) {
  const enabledRef = useRef(enabled)
  const rainIntensityRef = useRef(rainIntensity)
  const waterRiseSpeedRef = useRef(waterRiseSpeed)
  const setWaterLevelRef = useRef(setWaterLevel)

  useEffect(() => {
    enabledRef.current = enabled
    rainIntensityRef.current = rainIntensity
    waterRiseSpeedRef.current = waterRiseSpeed
    setWaterLevelRef.current = setWaterLevel
  }, [enabled, rainIntensity, waterRiseSpeed, setWaterLevel])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!enabledRef.current) return

      const intensity = rainIntensityRef.current
      const dt = TICK_MS / 1000

      if (intensity >= DRAINAGE_RAIN_THRESHOLD) {
        const rise = waterRiseSpeedRef.current * (intensity / 100) * dt
        setWaterLevelRef.current((prev) => {
          if (prev >= WATER_LEVEL_MAX) return prev
          return roundWaterLevel(Math.min(WATER_LEVEL_MAX, prev + rise))
        })
        return
      }

      if (intensity <= 0) {
        setWaterLevelRef.current((prev) => {
          if (prev <= 0) return prev
          return roundWaterLevel(Math.max(0, prev - DRAINAGE_RATE * dt))
        })
        return
      }

      const drainFactor = 1 - intensity / DRAINAGE_RAIN_THRESHOLD
      const drain = DRAINAGE_RATE * drainFactor * dt
      setWaterLevelRef.current((prev) => {
        if (prev <= 0) return prev
        return roundWaterLevel(Math.max(0, prev - drain))
      })
    }, TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [])
}
