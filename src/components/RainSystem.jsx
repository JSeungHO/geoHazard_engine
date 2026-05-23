import { useEffect, useRef } from 'react'
import {
  ParticleSystem,
  BoxEmitter,
  Cartesian2,
  Cartesian3,
  Color,
  Math as CesiumMath,
  Transforms,
} from 'cesium'
import { boundsChanged, getViewFloodBounds } from '../utils/floodViewBounds'

const EMITTER_ALTITUDE = 600

const emissionRateFromIntensity = (intensity) =>
  intensity === 0 ? 0 : Math.floor(20 + (intensity / 100) * 480)

const gravityScratch = new Cartesian3()

const applyGravity = (particle, dt) => {
  Cartesian3.normalize(particle.position, gravityScratch)
  Cartesian3.multiplyByScalar(gravityScratch, -280 * dt, gravityScratch)
  particle.velocity = Cartesian3.add(particle.velocity, gravityScratch, particle.velocity)
}

const createRainStreakImage = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 8
  canvas.height = 128
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createLinearGradient(0, 0, 0, 128)
  gradient.addColorStop(0, 'rgba(200, 230, 255, 0)')
  gradient.addColorStop(0.45, 'rgba(200, 230, 255, 0.95)')
  gradient.addColorStop(1, 'rgba(200, 230, 255, 0.15)')
  ctx.fillStyle = gradient
  ctx.fillRect(2, 0, 4, 128)

  return canvas.toDataURL('image/png')
}

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

const applyRainIntensity = (particleSystem, intensity) => {
  particleSystem.emissionRate = emissionRateFromIntensity(intensity)
  particleSystem.show = intensity > 0
}

const boundsToEmitterSize = (bounds) => {
  const latRad = CesiumMath.toRadians(bounds.centerLat)
  const metersPerDegreeLon = 111320 * Math.cos(latRad)
  const metersPerDegreeLat = 111320

  const widthM = Math.max(200, (bounds.east - bounds.west) * metersPerDegreeLon * 1.08)
  const depthM = Math.max(200, (bounds.north - bounds.south) * metersPerDegreeLat * 1.08)

  return { widthM, depthM }
}

const applyBoundsToRain = (particleSystem, bounds) => {
  const { widthM, depthM } = boundsToEmitterSize(bounds)
  const center = Cartesian3.fromDegrees(bounds.centerLon, bounds.centerLat, EMITTER_ALTITUDE)

  particleSystem.modelMatrix = Transforms.eastNorthUpToFixedFrame(center)
  particleSystem.emitter = new BoxEmitter(new Cartesian3(widthM / 2, depthM / 2, 400))
}

/** viewerRef.current 내부 객체만 갱신 (뷰어 재마운트 없음) */
export default function RainSystem({ viewerRef, intensity }) {
  const particleSystemRef = useRef(null)
  const intensityRef = useRef(intensity)
  const boundsRef = useRef(null)

  useEffect(() => {
    intensityRef.current = intensity
  }, [intensity])

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    const scene = viewer.scene
    viewer.clock.shouldAnimate = true

    const bounds = getViewFloodBounds(viewer)
    boundsRef.current = bounds

    const particleSystem = new ParticleSystem({
      image: createRainStreakImage(),
      startColor: Color.fromCssColorString('rgba(200, 230, 255, 0.95)'),
      endColor: Color.fromCssColorString('rgba(200, 230, 255, 0.08)'),
      startScale: 1.0,
      endScale: 0.6,
      minimumImageSize: new Cartesian2(3, 22),
      maximumImageSize: new Cartesian2(5, 38),
      particleLife: 2.2,
      speed: 28,
      speedIsRandomized: true,
      emissionRate: 0,
      emitter: new BoxEmitter(new Cartesian3(600, 600, 400)),
      minimumSpeed: 18,
      maximumSpeed: 42,
      updateCallback: applyGravity,
    })

    applyBoundsToRain(particleSystem, bounds)
    scene.primitives.add(particleSystem)
    particleSystemRef.current = particleSystem
    applyRainIntensity(particleSystem, intensityRef.current)

    const removeCameraListener = viewer.camera.moveEnd.addEventListener(() => {
      const nextBounds = getViewFloodBounds(viewer)
      if (!boundsChanged(boundsRef.current, nextBounds)) return

      boundsRef.current = nextBounds
      applyBoundsToRain(particleSystem, nextBounds)
      scene.requestRender()
    })

    return () => {
      removeCameraListener?.()
      if (!viewer.isDestroyed?.()) {
        scene.primitives.remove(particleSystem)
      }
      particleSystemRef.current = null
    }
  }, [viewerRef])

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    const particleSystem = particleSystemRef.current
    if (!viewer || !particleSystem) return

    applyRainIntensity(particleSystem, intensity)
    viewer.scene.requestRender()
  }, [intensity, viewerRef])

  return null
}
