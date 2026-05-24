import { useEffect, useRef } from 'react'
import { WaterWaveEngine } from '../../../physics/WaterWaveEngine'
import {
  createFloodBodyMaterial,
  createFloodBodyPrimitive,
  createWaterSurfaceCache,
  createWaterSurfacePrimitiveFromCache,
} from '../../../utils/floodWaterMesh'
import { createFloodSurfaceMaterial } from '../../../utils/floodWaterMaterial'
import { boundsChanged, addViewFloodBoundsListener, getViewFloodBounds } from '../../../utils/floodViewBounds'
import {
  refineTerrainHeightGrid,
  sampleTerrainHeightGrid,
  sampleTerrainHeightGridAsync,
  terrainGridChanged,
  upsampleTerrainGrid,
} from '../../../utils/terrainHeight'

const WAVE_RESOLUTION = 56
const TERRAIN_QUICK_RES = 16
const TERRAIN_REFINE_INTERVAL = 240
const BODY_REBUILD_THRESHOLD = 0.3
const BODY_REBUILD_INTERVAL_MS = 400
const BODY_OMIT_BELOW_LEVEL = 1.0
const SLOW_FRAME_THRESHOLD_MS = 22

const getSurfaceUpdateInterval = (engine) => {
  const heights = engine.heights
  const len = heights.length
  let sumSq = 0
  for (let i = 0; i < len; i += 4) sumSq += heights[i] * heights[i]
  const surfaceEnergy = (sumSq * 4) / len
  if (surfaceEnergy < 0.01) return 6
  if (surfaceEnergy < 0.5) return 3
  return 2
}

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
  if (sim.rafId != null) {
    cancelAnimationFrame(sim.rafId)
    sim.rafId = null
  }
  sim.terrainRefineToken = (sim.terrainRefineToken ?? 0) + 1
  sim.terrainSampleToken = (sim.terrainSampleToken ?? 0) + 1
  removePrimitive(viewer, sim.surface)
  removePrimitive(viewer, sim.body)
  simRef.current = null
}

const rebuildSurfaceCache = (sim, floodDepth) => {
  if (!sim.terrainGrid) {
    sim.surfaceCache = null
    return
  }

  sim.surfaceCache = createWaterSurfaceCache(
    sim.bounds,
    sim.terrainGrid,
    floodDepth,
    WAVE_RESOLUTION,
    { floodMask: sim.floodMask ?? null }
  )
}

const syncSurfacePrimitive = (viewer, sim) => {
  if (!sim.surfaceCache) return

  removePrimitive(viewer, sim.surface)
  sim.surface = createWaterSurfacePrimitiveFromCache(
    sim.surfaceCache,
    sim.engine,
    sim.surfaceMaterial,
    sim.positionBuffer
  )
  if (sim.surface) viewer.scene.primitives.add(sim.surface)
}

const rebuildFloodBody = (viewer, sim, floodDepth, now = performance.now()) => {
  removePrimitive(viewer, sim.body)
  if (sim.omitBody || floodDepth < BODY_OMIT_BELOW_LEVEL) {
    sim.body = null
    sim.lastBodyLevel = floodDepth
    sim.lastBodyRebuildMs = now
    return
  }
  sim.body = createFloodBodyPrimitive(
    floodDepth,
    sim.bodyMaterial,
    sim.bounds,
    sim.terrainGrid,
    { floodMask: sim.floodMask ?? null }
  )
  if (sim.body) viewer.scene.primitives.add(sim.body)
  sim.lastBodyLevel = floodDepth
  sim.lastBodyRebuildMs = now
}

const syncBodyForLevel = (viewer, sim, level, now) => {
  if (sim.omitBody) return

  if (level < BODY_OMIT_BELOW_LEVEL) {
    if (sim.body) {
      removePrimitive(viewer, sim.body)
      sim.body = null
    }
    sim.lastBodyLevel = level
    return
  }

  const deltaLevel = Math.abs(level - (sim.lastBodyLevel ?? NaN))
  const deltaTime = now - (sim.lastBodyRebuildMs ?? 0)

  if (
    !Number.isFinite(sim.lastBodyLevel)
    || (deltaLevel >= BODY_REBUILD_THRESHOLD && deltaTime >= BODY_REBUILD_INTERVAL_MS)
  ) {
    rebuildFloodBody(viewer, sim, level, now)
  }
}

const createTerrainLoadTracker = (onTerrainLoadingChange) => {
  let pending = 0

  const begin = () => {
    pending += 1
    onTerrainLoadingChange?.(true)
  }

  const end = () => {
    pending = Math.max(0, pending - 1)
    if (pending === 0) onTerrainLoadingChange?.(false)
  }

  return { begin, end }
}

const rebuildFloodMeshes = (viewer, sim, floodDepth, bounds) => {
  removePrimitive(viewer, sim.surface)
  removePrimitive(viewer, sim.body)

  sim.bounds = bounds

  const quickGrid = sampleTerrainHeightGrid(viewer, bounds, TERRAIN_QUICK_RES)
  sim.terrainGrid = upsampleTerrainGrid(quickGrid, WAVE_RESOLUTION)

  rebuildSurfaceCache(sim, floodDepth)
  rebuildFloodBody(viewer, sim, floodDepth)
  syncSurfacePrimitive(viewer, sim)
}

const requestFullTerrainSample = (viewer, simRef, sim, waterLevelRef, terrainLoad) => {
  const token = (sim.terrainSampleToken ?? 0) + 1
  sim.terrainSampleToken = token
  terrainLoad?.begin()

  sampleTerrainHeightGridAsync(viewer, sim.bounds, WAVE_RESOLUTION)
    .then((sampled) => {
      if (!sampled || sim.terrainSampleToken !== token) return
      if (viewer.isDestroyed?.() || simRef.current !== sim) return
      if (!terrainGridChanged(sim.terrainGrid, sampled, 0.15)) return

      sim.terrainGrid = sampled
      const level = waterLevelRef.current
      if (level <= 0) return

      rebuildSurfaceCache(sim, level)
      rebuildFloodBody(viewer, sim, level)
      syncSurfacePrimitive(viewer, sim)
      viewer.scene.requestRender()
    })
    .finally(() => {
      terrainLoad?.end()
    })
}

const resetWaveEngine = (sim, level) => {
  sim.engine = new WaterWaveEngine(WAVE_RESOLUTION)
  sim.engine.addDisturbance(0.5, 0.5, 0.28, Math.min(level * 0.04, 1.2))
  sim.frameCount = 0
}

const requestTerrainRefine = (viewer, simRef, sim, waterLevelRef, terrainLoad) => {
  if (sim.terrainRefineInFlight) return

  const token = (sim.terrainRefineToken ?? 0) + 1
  sim.terrainRefineToken = token
  sim.terrainRefineInFlight = true
  terrainLoad?.begin()

  refineTerrainHeightGrid(viewer, sim.bounds, WAVE_RESOLUTION)
    .then((refined) => {
      if (!refined || sim.terrainRefineToken !== token) return
      if (viewer.isDestroyed?.() || simRef.current !== sim) return
      if (!terrainGridChanged(sim.terrainGrid, refined)) return

      sim.terrainGrid = refined
      const level = waterLevelRef.current
      if (level <= 0) return

      rebuildSurfaceCache(sim, level)
      rebuildFloodBody(viewer, sim, level)
      syncSurfacePrimitive(viewer, sim)
      viewer.scene.requestRender()
    })
    .finally(() => {
      sim.terrainRefineInFlight = false
      terrainLoad?.end()
    })
}

const startSimulation = (
  viewer,
  initialLevel,
  simRef,
  waterLevelRef,
  rainIntensityRef,
  simulationOptionsRef,
  boundsRef,
  onTerrainLoadingChange,
  surfaceMaterialFactory = createFloodSurfaceMaterial,
  bodyMaterialFactory = createFloodBodyMaterial,
  fixedBounds = null,
  floodMask = null,
  omitBody = false
) => {
  stopSimulation(viewer, simRef)
  onTerrainLoadingChange?.(false)

  const terrainLoad = createTerrainLoadTracker(onTerrainLoadingChange)

  const bounds = fixedBounds ?? boundsRef.current ?? getViewFloodBounds(viewer)
  boundsRef.current = bounds

  const engine = new WaterWaveEngine(WAVE_RESOLUTION)
  engine.addDisturbance(0.5, 0.5, 0.28, Math.min(initialLevel * 0.04, 1.2))

  const surfaceMaterial = surfaceMaterialFactory()
  const bodyMaterial = bodyMaterialFactory()
  applySimulationOptions(engine, surfaceMaterial, simulationOptionsRef.current)

  const sim = {
    engine,
    surfaceMaterial,
    bodyMaterial,
    bounds,
    floodMask,
    omitBody,
    terrainGrid: null,
    surfaceCache: null,
    terrainRefineToken: 0,
    terrainSampleToken: 0,
    terrainRefineInFlight: false,
    baseLevel: initialLevel,
    lastBodyLevel: initialLevel,
    lastBodyRebuildMs: performance.now(),
    positionBuffer: new Float64Array(WAVE_RESOLUTION * WAVE_RESOLUTION * 3),
    surface: null,
    body: null,
    removeListener: null,
    removeCameraListener: null,
    rafId: null,
    frameCount: 0,
    lastFrameMs: performance.now(),
    lastFrameDeltaMs: 0,
    surfaceDirty: true,
  }

  rebuildFloodMeshes(viewer, sim, initialLevel, bounds)
  simRef.current = sim
  requestFullTerrainSample(viewer, simRef, sim, waterLevelRef, terrainLoad)
  requestTerrainRefine(viewer, simRef, sim, waterLevelRef, terrainLoad)

  // fixedBounds가 지정된 경우 카메라 이동에 따라 침수 범위가 바뀌지 않도록 리스너 생략
  if (!fixedBounds) {
    sim.removeCameraListener = addViewFloodBoundsListener(
      viewer,
      (nextBounds) => {
        if (!boundsChanged(sim.bounds, nextBounds)) return

        boundsRef.current = nextBounds
        resetWaveEngine(sim, waterLevelRef.current)
        rebuildFloodMeshes(viewer, sim, waterLevelRef.current, nextBounds)
        requestFullTerrainSample(viewer, simRef, sim, waterLevelRef, terrainLoad)
        requestTerrainRefine(viewer, simRef, sim, waterLevelRef, terrainLoad)
      },
      { debounceMs: 200 }
    )
  }

  sim.removeListener = viewer.scene.postUpdate.addEventListener(() => {
    try {
      const level = waterLevelRef.current
      const rain = rainIntensityRef.current
      const options = simulationOptionsRef.current

      if (level <= 0) return

      const now = performance.now()
      const deltaSeconds = Math.min((now - sim.lastFrameMs) / 1000, 0.05)
      sim.lastFrameDeltaMs = deltaSeconds * 1000
      sim.lastFrameMs = now

      if (sim.frameCount > 0 && sim.frameCount % TERRAIN_REFINE_INTERVAL === 0) {
        requestTerrainRefine(viewer, simRef, sim, waterLevelRef, terrainLoad)
      }

      applySimulationOptions(sim.engine, sim.surfaceMaterial, options)

      if (sim.baseLevel !== level) {
        const delta = level - sim.baseLevel
        sim.engine.addDisturbance(0.5, 0.5, 0.32, delta * 0.03)
        rebuildSurfaceCache(sim, level)
        syncBodyForLevel(viewer, sim, level, now)
        sim.baseLevel = level
        sim.surfaceDirty = true
      }

      sim.engine.step(deltaSeconds)

      sim.frameCount += 1
      if (rain > 0 && sim.frameCount % 5 === 0) {
        sim.engine.addRainImpacts(rain, options.rainImpactStrength)
      }

      sim.surfaceDirty = true
    } catch (error) {
      console.error('[FloodVisualization] simulation step failed:', error)
    }
  })

  const renderSurface = () => {
    sim.rafId = requestAnimationFrame(renderSurface)

    if (simRef.current !== sim || waterLevelRef.current <= 0) return

    if (sim.lastFrameDeltaMs > SLOW_FRAME_THRESHOLD_MS) return

    const surfaceInterval = getSurfaceUpdateInterval(sim.engine)
    if (!sim.surfaceDirty || sim.frameCount % surfaceInterval !== 0) return

    try {
      syncSurfacePrimitive(viewer, sim)
      sim.surfaceDirty = false
      viewer.scene.requestRender()
    } catch (error) {
      console.error('[FloodVisualization] surface update failed:', error)
    }
  }

  sim.rafId = requestAnimationFrame(renderSurface)

  return undefined
}

/**
 * viewerRef + WaterWaveEngine 기반 물리 수면.
 * 카메라 화면 범위 + 지형 그리드 클램핑.
 *
 * fixedBounds — 제공 시 카메라 이동에 관계없이 이 범위로 침수 영역을 고정한다.
 * 쓰나미 모듈처럼 카메라가 광역 조망 위치로 이동해도 범위가 바뀌지 않아야 할 때 사용.
 */
export default function FloodVisualization({
  viewerRef,
  waterLevel,
  rainIntensity = 0,
  simulationOptions,
  onTerrainLoadingChange,
  surfaceMaterialFactory = createFloodSurfaceMaterial,
  bodyMaterialFactory = createFloodBodyMaterial,
  fixedBounds = null,
  floodMask = null,
  omitBody = false,
}) {
  const onTerrainLoadingChangeRef = useRef(onTerrainLoadingChange)
  const surfaceMaterialFactoryRef = useRef(surfaceMaterialFactory)
  const bodyMaterialFactoryRef = useRef(bodyMaterialFactory)
  const fixedBoundsRef = useRef(fixedBounds)
  const floodMaskRef = useRef(floodMask)
  const omitBodyRef = useRef(omitBody)

  useEffect(() => {
    fixedBoundsRef.current = fixedBounds
  }, [fixedBounds])

  useEffect(() => {
    omitBodyRef.current = omitBody
  }, [omitBody])

  useEffect(() => {
    floodMaskRef.current = floodMask

    const viewer = getViewer(viewerRef)
    const sim = simRef.current
    if (!viewer || !sim || waterLevelRef.current <= 0) return

    sim.floodMask = floodMask ?? null
    rebuildSurfaceCache(sim, waterLevelRef.current)
    rebuildFloodBody(viewer, sim, waterLevelRef.current)
    syncSurfacePrimitive(viewer, sim)
    viewer.scene.requestRender()
  }, [floodMask, viewerRef])

  useEffect(() => {
    onTerrainLoadingChangeRef.current = onTerrainLoadingChange
  }, [onTerrainLoadingChange])

  useEffect(() => {
    surfaceMaterialFactoryRef.current = surfaceMaterialFactory
    bodyMaterialFactoryRef.current = bodyMaterialFactory
  }, [surfaceMaterialFactory, bodyMaterialFactory])
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
      onTerrainLoadingChangeRef.current?.(false)
      return undefined
    }

    startSimulation(
      viewer,
      waterLevelRef.current,
      simRef,
      waterLevelRef,
      rainIntensityRef,
      simulationOptionsRef,
      boundsRef,
      (loading) => onTerrainLoadingChangeRef.current?.(loading),
      surfaceMaterialFactoryRef.current,
      bodyMaterialFactoryRef.current,
      fixedBoundsRef.current,
      floodMaskRef.current,
      omitBodyRef.current
    )

    return () => stopSimulation(viewer, simRef)
  }, [viewerRef, isSimulationActive])

  return null
}
