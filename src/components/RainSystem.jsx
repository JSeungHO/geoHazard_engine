import { useEffect, useRef } from 'react'
import {
  ParticleSystem,
  BoxEmitter,
  Cartesian2,
  Cartesian3,
  Color,
  Matrix4,
  Quaternion,
} from 'cesium'
import { GANGNAM_LAT, GANGNAM_LON } from '../constants/gangnam'

const EMITTER_ALTITUDE = 800

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

/** viewerRef.current 내부 객체만 갱신 (뷰어 재마운트 없음) */
export default function RainSystem({ viewerRef, intensity }) {
  const particleSystemRef = useRef(null)
  const intensityRef = useRef(intensity)
  intensityRef.current = intensity

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return

    const scene = viewer.scene
    const position = Cartesian3.fromDegrees(GANGNAM_LON, GANGNAM_LAT, EMITTER_ALTITUDE)

    const particleSystem = new ParticleSystem({
      image: createRainStreakImage(),
      startColor: Color.fromCssColorString('rgba(200, 230, 255, 0.9)'),
      endColor: Color.fromCssColorString('rgba(200, 230, 255, 0.05)'),
      startScale: 1.0,
      endScale: 0.6,
      minimumImageSize: new Cartesian2(2, 18),
      maximumImageSize: new Cartesian2(4, 32),
      particleLife: 1.8,
      speed: 30,
      speedIsRandomized: true,
      lifetime: 60.0,
      emissionRate: emissionRateFromIntensity(intensityRef.current),
      emitter: new BoxEmitter(new Cartesian3(1200, 1200, 600)),
      modelMatrix: Matrix4.fromTranslationQuaternionRotationScale(
        position,
        Quaternion.IDENTITY,
        new Cartesian3(1, 1, 1)
      ),
      minimumSpeed: 20,
      maximumSpeed: 40,
      updateCallback: applyGravity,
    })

    particleSystem.show = intensityRef.current > 0
    scene.primitives.add(particleSystem)
    particleSystemRef.current = particleSystem

    return () => {
      if (!viewer.isDestroyed?.()) {
        scene.primitives.remove(particleSystem)
      }
      particleSystemRef.current = null
    }
  }, [viewerRef])

  useEffect(() => {
    const particleSystem = particleSystemRef.current
    if (!particleSystem) return

    particleSystem.emissionRate = emissionRateFromIntensity(intensity)
    particleSystem.show = intensity > 0
  }, [intensity])

  return null
}
