import { useEffect, useRef } from 'react'

const WATER_LEVEL_MAX = 100
const TICK_MS = 50

const roundWaterLevel = (value) => Math.round(value * 100) / 100

/**
 * 토글이 켜진 동안 강수량에 비례해 침수 깊이(m)를 자동 증가.
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
      if (intensity <= 0) return

      const rise = waterRiseSpeedRef.current * (intensity / 100) * (TICK_MS / 1000)

      setWaterLevelRef.current((prev) => {
        if (prev >= WATER_LEVEL_MAX) return prev
        return roundWaterLevel(Math.min(WATER_LEVEL_MAX, prev + rise))
      })
    }, TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [])
}
