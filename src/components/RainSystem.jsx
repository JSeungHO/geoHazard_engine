import { useEffect, useRef } from 'react'
import { ParticleSystem, BoxEmitter, Cartesian3, Color, Matrix4, Quaternion } from 'cesium'

const createParticleImage = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = 'rgba(200, 230, 255, 0.8)'
  ctx.beginPath()
  ctx.arc(32, 32, 16, 0, Math.PI * 2)
  ctx.fill()

  return canvas.toDataURL('image/png')
}

export default function RainSystem({ viewer, intensity }) {
  const particleSystemRef = useRef(null)
  const particleImageRef = useRef(null)

  useEffect(() => {
    if (!particleImageRef.current) {
      particleImageRef.current = createParticleImage()
    }
  }, [])

  useEffect(() => {
    if (!viewer) return

    const scene = viewer.scene
    const position = Cartesian3.fromDegrees(127.0267, 37.4975, 1500)

    if (particleSystemRef.current) {
      scene.primitives.remove(particleSystemRef.current)
    }

    if (intensity === 0) {
      particleSystemRef.current = null
      return
    }

    const particleCount = Math.floor(intensity * 2)

    const particleSystem = new ParticleSystem({
      image: particleImageRef.current,
      startColor: Color.fromCssColorString('rgba(200, 230, 255, 0.8)'),
      endColor: Color.fromCssColorString('rgba(200, 230, 255, 0)'),
      startScale: 0.5 + (intensity / 100) * 0.3,
      endScale: 0.2,
      particleLife: 2.0,
      speed: 30 + (intensity / 100) * 20,
      speedIsRandomized: true,
      lifetime: 60.0,
      emissionRate: particleCount,
      emitter: new BoxEmitter(new Cartesian3(800, 800, 400)),
      modelMatrix: Matrix4.fromTranslationQuaternionRotationScale(
        position,
        Quaternion.IDENTITY,
        new Cartesian3(1, 1, 1)
      ),
      minimumSpeed: 25,
      maximumSpeed: 50 + (intensity / 100) * 10,
    })

    scene.primitives.add(particleSystem)
    particleSystemRef.current = particleSystem
  }, [viewer, intensity])

  return null
}
