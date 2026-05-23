import { useEffect, useRef } from 'react'
import { WaterWaveEngine } from '../physics/WaterWaveEngine'
import {
  createFloodBodyMaterial,
  createFloodBodyPrimitive,
  createWaterSurfacePrimitive,
} from '../utils/floodWaterMesh'
import { createFloodSurfaceMaterial } from '../utils/floodWaterMaterial'

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

const removePrimitive = (viewer, primitive) => {
  if (primitive && !viewer.isDestroyed?.()) {
    viewer.scene.primitives.remove(primitive)
  }
}

const stopSimulation = (viewer, simRef) => {
  const sim = simRef.current
  if (!sim || !viewer) return

  sim.removeListener?.()
  removePrimitive(viewer, sim.surface)
  removePrimitive(viewer, sim.body)
  simRef.current = null
}

const startSimulation = (viewer, initialLevel, simRef, waterLevelRef, rainIntensityRef) => {
  stopSimulation(viewer, simRef)

  const engine = new WaterWaveEngine(56)
  engine.addDisturbance(0.5, 0.5, 0.28, Math.min(initialLevel * 0.04, 1.2))

  const surfaceMaterial = createFloodSurfaceMaterial()
  const bodyMaterial = createFloodBodyMaterial()

  const sim = {
    engine,
    surfaceMaterial,
    bodyMaterial,
    baseLevel: initialLevel,
    surface: null,
    body: createFloodBodyPrimitive(initialLevel, bodyMaterial),
    removeListener: null,
    frameCount: 0,
    lastFrameMs: performance.now(),
  }

  viewer.scene.primitives.add(sim.body)
  sim.surface = createWaterSurfacePrimitive(engine, initialLevel, surfaceMaterial)
  viewer.scene.primitives.add(sim.surface)

  sim.removeListener = viewer.scene.postUpdate.addEventListener(() => {
    try {
      const level = waterLevelRef.current
      const rain = rainIntensityRef.current

      if (level <= 0) return

      const now = performance.now()
      const deltaSeconds = Math.min((now - sim.lastFrameMs) / 1000, 0.05)
      sim.lastFrameMs = now

      if (sim.baseLevel !== level) {
        const delta = level - sim.baseLevel
        engine.addDisturbance(0.5, 0.5, 0.32, delta * 0.03)
        removePrimitive(viewer, sim.body)
        sim.body = createFloodBodyPrimitive(level, bodyMaterial)
        viewer.scene.primitives.add(sim.body)
        sim.baseLevel = level
      }

      engine.step(deltaSeconds)

      sim.frameCount += 1
      if (rain > 0 && sim.frameCount % 5 === 0) {
        engine.addRainImpacts(rain, 0.03)
      }

      removePrimitive(viewer, sim.surface)
      sim.surface = createWaterSurfacePrimitive(engine, level, surfaceMaterial)
      viewer.scene.primitives.add(sim.surface)
    } catch (error) {
      console.error('[FloodVisualization] simulation step failed:', error)
    }
  })

  simRef.current = sim
}

/**
 * viewerRef + WaterWaveEngine 기반 물리 수면.
 * postUpdate마다 파동 1스텝 → 수면 mesh 재생성 (정점 높이 = 수위 + 파동).
 */
export default function FloodVisualization({ viewerRef, waterLevel, rainIntensity = 0 }) {
  const simRef = useRef(null)
  const waterLevelRef = useRef(waterLevel)
  const rainIntensityRef = useRef(rainIntensity)
  const isSimulationActive = waterLevel > 0

  useEffect(() => {
    waterLevelRef.current = waterLevel
  }, [waterLevel])

  useEffect(() => {
    rainIntensityRef.current = rainIntensity
  }, [rainIntensity])

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    if (!isSimulationActive) {
      stopSimulation(viewer, simRef)
      return undefined
    }

    startSimulation(viewer, waterLevelRef.current, simRef, waterLevelRef, rainIntensityRef)

    return () => stopSimulation(viewer, simRef)
  }, [viewerRef, isSimulationActive])

  return null
}
