import { useEffect, useRef } from 'react'
import { WaterWaveEngine } from '../physics/WaterWaveEngine'
import {
  createFloodBodyMaterial,
  createFloodBodyPrimitive,
  createWaterSurfacePrimitive,
} from '../utils/floodWaterMesh'
import { createFloodSurfaceMaterial } from '../utils/floodWaterMaterial'
import { boundsChanged, getViewFloodBounds } from '../utils/floodViewBounds'
import { getTerrainHeightAtBounds } from '../utils/terrainHeight'

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

const applySimulationOptions = (engine, surfaceMaterial, options) => {
  engine.timeScale = options.waveTimeScale
  engine.stiffness = options.waveStiffness
  engine.maxAmplitude = options.waveMaxAmplitude

  if (surfaceMaterial?.uniforms) {
    surfaceMaterial.uniforms.glintStrength = options.glintStrength
    surfaceMaterial.uniforms.reflectivity = options.reflectivity
  }
}

const stopSimulation = (viewer, simRef) => {
  const sim = simRef.current
  if (!sim || !viewer) return

  sim.removeListener?.()
  sim.removeCameraListener?.()
  removePrimitive(viewer, sim.surface)
  removePrimitive(viewer, sim.body)
  simRef.current = null
}

const rebuildFloodMeshes = (viewer, sim, floodDepth, bounds) => {
  removePrimitive(viewer, sim.surface)
  removePrimitive(viewer, sim.body)

  sim.bounds = bounds
  sim.terrainBase = getTerrainHeightAtBounds(viewer, bounds)
  sim.body = createFloodBodyPrimitive(floodDepth, sim.bodyMaterial, bounds, sim.terrainBase)
  viewer.scene.primitives.add(sim.body)

  sim.surface = createWaterSurfacePrimitive(
    sim.engine,
    floodDepth,
    sim.surfaceMaterial,
    bounds,
    sim.terrainBase
  )
  viewer.scene.primitives.add(sim.surface)
}

const resetWaveEngine = (sim, level) => {
  sim.engine = new WaterWaveEngine(56)
  sim.engine.addDisturbance(0.5, 0.5, 0.28, Math.min(level * 0.04, 1.2))
  sim.frameCount = 0
}

const startSimulation = (
  viewer,
  initialLevel,
  simRef,
  waterLevelRef,
  rainIntensityRef,
  simulationOptionsRef,
  boundsRef
) => {
  stopSimulation(viewer, simRef)

  const bounds = boundsRef.current ?? getViewFloodBounds(viewer)
  boundsRef.current = bounds

  const engine = new WaterWaveEngine(56)
  engine.addDisturbance(0.5, 0.5, 0.28, Math.min(initialLevel * 0.04, 1.2))

  const surfaceMaterial = createFloodSurfaceMaterial()
  const bodyMaterial = createFloodBodyMaterial()
  applySimulationOptions(engine, surfaceMaterial, simulationOptionsRef.current)

  const sim = {
    engine,
    surfaceMaterial,
    bodyMaterial,
    bounds,
    baseLevel: initialLevel,
    surface: null,
    body: null,
    removeListener: null,
    removeCameraListener: null,
    frameCount: 0,
    lastFrameMs: performance.now(),
  }

  rebuildFloodMeshes(viewer, sim, initialLevel, bounds)

  const syncBoundsFromView = () => {
    const nextBounds = getViewFloodBounds(viewer)
    if (!boundsChanged(sim.bounds, nextBounds)) return

    boundsRef.current = nextBounds
    resetWaveEngine(sim, waterLevelRef.current)
    rebuildFloodMeshes(viewer, sim, waterLevelRef.current, nextBounds)
  }

  sim.removeCameraListener = viewer.camera.moveEnd.addEventListener(syncBoundsFromView)

  sim.removeListener = viewer.scene.postUpdate.addEventListener(() => {
    try {
      const level = waterLevelRef.current
      const rain = rainIntensityRef.current
      const options = simulationOptionsRef.current

      if (level <= 0) return

      const now = performance.now()
      const deltaSeconds = Math.min((now - sim.lastFrameMs) / 1000, 0.05)
      sim.lastFrameMs = now

      if (sim.terrainBase === 0 && sim.frameCount % 20 === 0) {
        const sampledBase = getTerrainHeightAtBounds(viewer, sim.bounds)
        if (sampledBase > 0 && sampledBase !== sim.terrainBase) {
          sim.terrainBase = sampledBase
          removePrimitive(viewer, sim.body)
          sim.body = createFloodBodyPrimitive(level, bodyMaterial, sim.bounds, sim.terrainBase)
          viewer.scene.primitives.add(sim.body)
        }
      }

      applySimulationOptions(sim.engine, sim.surfaceMaterial, options)

      if (sim.baseLevel !== level) {
        const delta = level - sim.baseLevel
        sim.engine.addDisturbance(0.5, 0.5, 0.32, delta * 0.03)
        removePrimitive(viewer, sim.body)
        sim.body = createFloodBodyPrimitive(level, bodyMaterial, sim.bounds, sim.terrainBase)
        viewer.scene.primitives.add(sim.body)
        sim.baseLevel = level
      }

      sim.engine.step(deltaSeconds)

      sim.frameCount += 1
      if (rain > 0 && sim.frameCount % 5 === 0) {
        sim.engine.addRainImpacts(rain, options.rainImpactStrength)
      }

      removePrimitive(viewer, sim.surface)
      sim.surface = createWaterSurfacePrimitive(
        sim.engine,
        level,
        sim.surfaceMaterial,
        sim.bounds,
        sim.terrainBase
      )
      viewer.scene.primitives.add(sim.surface)
    } catch (error) {
      console.error('[FloodVisualization] simulation step failed:', error)
    }
  })

  simRef.current = sim
}

/**
 * viewerRef + WaterWaveEngine 기반 물리 수면.
 * 카메라 화면 범위에 맞춰 물 영역 위치·크기 갱신.
 */
export default function FloodVisualization({
  viewerRef,
  waterLevel,
  rainIntensity = 0,
  simulationOptions,
}) {
  const simRef = useRef(null)
  const boundsRef = useRef(null)
  const waterLevelRef = useRef(waterLevel)
  const rainIntensityRef = useRef(rainIntensity)
  const simulationOptionsRef = useRef(simulationOptions)
  const isSimulationActive = waterLevel > 0

  useEffect(() => {
    waterLevelRef.current = waterLevel
    rainIntensityRef.current = rainIntensity
    simulationOptionsRef.current = simulationOptions
  }, [waterLevel, rainIntensity, simulationOptions])

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    if (!isSimulationActive) {
      stopSimulation(viewer, simRef)
      return undefined
    }

    startSimulation(
      viewer,
      waterLevelRef.current,
      simRef,
      waterLevelRef,
      rainIntensityRef,
      simulationOptionsRef,
      boundsRef
    )

    return () => stopSimulation(viewer, simRef)
  }, [viewerRef, isSimulationActive])

  return null
}
