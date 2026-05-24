import { useEffect, useRef } from 'react'
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantPositionProperty,
  Ellipsoid,
  LabelStyle,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium'
import { TsunamiWaveModel } from '../../../physics/TsunamiWaveModel'
import { getCoastalSurgeBasis } from '../constants/coastalSurgeLayout'
import { TsunamiRunupPrimitiveLayer } from '../utils/tsunamiRunupPrimitives'
import { buildRunupSites } from '../utils/tsunamiRunupSites'

const EPICENTER_ENTITY_ID = 'tsunami-epicenter'
const RING_ENTITY_ID = 'tsunami-ring'
const SHOCKWAVE_ENTITY_ID = 'tsunami-shockwave'
const WAVE_TRAIN_PREFIX = 'tsunami-wave-train-'
const EPICENTER_PULSE_PREFIX = 'tsunami-epicenter-pulse-'
const COASTAL_ENTITY_PREFIX = 'tsunami-coast-'
const SUMMARY_REPORT_INTERVAL_MS = 80

const TRAIL_RATIO = 0.92
const WAVE_TRAIN_RATIOS = [0.78, 0.62]
const EPICENTER_PULSE_RADII_M = [18_000, 32_000, 48_000]

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

const positionFromLonLat = (lon, lat) =>
  new ConstantPositionProperty(Cartesian3.fromDegrees(lon, lat, 0))

const removeEntityById = (viewer, id) => {
  const entity = viewer.entities.getById(id)
  if (entity) viewer.entities.remove(entity)
}

const removeCoastalMarkers = (viewer) => {
  const toRemove = viewer.entities.values.filter((entity) =>
    String(entity.id).startsWith(COASTAL_ENTITY_PREFIX)
  )
  toRemove.forEach((entity) => viewer.entities.remove(entity))
}

const removeCoastalEntities = (viewer) => {
  removeCoastalMarkers(viewer)
}

const createEpicenterEntity = (viewer, epicenter) =>
  viewer.entities.add({
    id: EPICENTER_ENTITY_ID,
    position: positionFromLonLat(epicenter.lon, epicenter.lat),
    point: {
      pixelSize: 14,
      color: Color.fromCssColorString('#ff3a3a'),
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: '진원',
      font: 'bold 12px sans-serif',
      pixelOffset: new Cartesian2(0, -26),
      fillColor: Color.WHITE,
      outlineColor: Color.fromCssColorString('#1a1a2e'),
      outlineWidth: 2,
      style: LabelStyle.FILL_AND_OUTLINE,
    },
  })

const syncCoastalEntities = (viewer, impactPoints, summary, epicenter) => {
  const activeIds = new Set(impactPoints.map((point) => point.id))

  viewer.entities.values
    .filter((entity) => String(entity.id).startsWith(COASTAL_ENTITY_PREFIX))
    .forEach((entity) => {
      const pointId = String(entity.id).slice(COASTAL_ENTITY_PREFIX.length)
      if (!activeIds.has(pointId)) viewer.entities.remove(entity)
    })

  impactPoints.forEach((point) => {
    const impact = summary?.impacts?.find((item) => item.id === point.id)
    const reached = impact?.reached
    const approaching = !reached && (impact?.approachProgress ?? 0) > 0.12
    const waveHeightM = reached
      ? (impact?.waveHeightM ?? 0)
      : (impact?.travelWaveHeightM ?? 0)

    const markerPos = epicenter
      ? getCoastalSurgeBasis(point, epicenter).shorePoint
      : { lat: point.lat, lon: point.lon }

    const entityId = `${COASTAL_ENTITY_PREFIX}${point.id}`
    let entity = viewer.entities.getById(entityId)

    const labelText = reached
      ? `${point.label} ${waveHeightM.toFixed(1)}m`
      : approaching
        ? `${point.label} 접근 ${(impact.approachProgress * 100).toFixed(0)}%`
        : point.label

    if (!entity) {
      viewer.entities.add({
        id: entityId,
        position: positionFromLonLat(markerPos.lon, markerPos.lat),
        point: {
          pixelSize: reached ? 12 : approaching ? 10 : 8,
          color: reached
            ? Color.fromCssColorString('#ff8c42')
            : approaching
              ? Color.fromCssColorString('#ffb347')
              : Color.fromCssColorString('#6b8caf'),
          outlineColor: Color.WHITE,
          outlineWidth: 1,
        },
        label: {
          text: labelText,
          font: '11px sans-serif',
          pixelOffset: new Cartesian2(0, -18),
          fillColor: reached
            ? Color.fromCssColorString('#ffd4a8')
            : approaching
              ? Color.fromCssColorString('#ffe0b0')
              : Color.fromCssColorString('#a8c4e8'),
          outlineColor: Color.fromCssColorString('#1a1a2e'),
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
        },
      })
      return
    }

    entity.position = positionFromLonLat(markerPos.lon, markerPos.lat)
    entity.point.pixelSize = reached ? 12 : approaching ? 10 : 8
    entity.point.color = reached
      ? Color.fromCssColorString('#ff8c42')
      : approaching
        ? Color.fromCssColorString('#ffb347')
        : Color.fromCssColorString('#6b8caf')
    entity.label.text = labelText
    entity.label.fillColor = reached
      ? Color.fromCssColorString('#ffd4a8')
      : approaching
        ? Color.fromCssColorString('#ffe0b0')
        : Color.fromCssColorString('#a8c4e8')
  })
}

const createRingEntity = (viewer, epicenter, radiusRef, pulseRef) =>
  viewer.entities.add({
    id: RING_ENTITY_ID,
    position: positionFromLonLat(epicenter.lon, epicenter.lat),
    ellipse: {
      semiMajorAxis: new CallbackProperty(() => Math.max(radiusRef.current, 1000), false),
      semiMinorAxis: new CallbackProperty(() => Math.max(radiusRef.current, 1000), false),
      material: new ColorMaterialProperty(
        new CallbackProperty(
          () => new Color(0.06, 0.36, 0.88, 0.02 + pulseRef.current * 0.07),
          false
        )
      ),
      outline: true,
      outlineColor: new CallbackProperty(
        () => new Color(0.1, 0.56, 1.0, 0.22 + pulseRef.current * 0.38),
        false
      ),
      outlineWidth: 3,
      height: 0,
    },
  })

const createShockwaveEntity = (viewer, epicenter, radiusRef, pulseRef) =>
  viewer.entities.add({
    id: SHOCKWAVE_ENTITY_ID,
    position: positionFromLonLat(epicenter.lon, epicenter.lat),
    ellipse: {
      semiMajorAxis: new CallbackProperty(
        () => Math.max(radiusRef.current * TRAIL_RATIO, 500),
        false
      ),
      semiMinorAxis: new CallbackProperty(
        () => Math.max(radiusRef.current * TRAIL_RATIO, 500),
        false
      ),
      material: new ColorMaterialProperty(
        new CallbackProperty(
          () => new Color(0.12, 0.52, 1.0, 0.02 + (1 - pulseRef.current) * 0.06),
          false
        )
      ),
      outline: true,
      outlineColor: new CallbackProperty(
        () => new Color(0.18, 0.64, 1.0, 0.12 + (1 - pulseRef.current) * 0.22),
        false
      ),
      outlineWidth: 2,
      height: 0,
    },
  })

const createWaveTrainEntities = (viewer, epicenter, radiusRef, pulseRef) => {
  WAVE_TRAIN_RATIOS.forEach((ratio, index) => {
    viewer.entities.add({
      id: `${WAVE_TRAIN_PREFIX}${index}`,
      position: positionFromLonLat(epicenter.lon, epicenter.lat),
      ellipse: {
        semiMajorAxis: new CallbackProperty(
          () => Math.max(radiusRef.current * ratio, 400),
          false
        ),
        semiMinorAxis: new CallbackProperty(
          () => Math.max(radiusRef.current * ratio, 400),
          false
        ),
        material: new ColorMaterialProperty(
          new CallbackProperty(
            () => new Color(0.08, 0.44, 0.92, 0.015 + pulseRef.current * 0.04),
            false
          )
        ),
        outline: true,
        outlineColor: new CallbackProperty(
          () => new Color(0.14, 0.58, 1.0, 0.1 + pulseRef.current * 0.25),
          false
        ),
        outlineWidth: 2,
        height: 0,
      },
    })
  })
}

const createEpicenterPulseEntities = (viewer, epicenter, pulseRef) => {
  EPICENTER_PULSE_RADII_M.forEach((radiusM, index) => {
    viewer.entities.add({
      id: `${EPICENTER_PULSE_PREFIX}${index}`,
      position: positionFromLonLat(epicenter.lon, epicenter.lat),
      ellipse: {
        semiMajorAxis: radiusM,
        semiMinorAxis: radiusM,
        material: new ColorMaterialProperty(
          new CallbackProperty(
            () => new Color(1.0, 0.35, 0.2, 0.06 + pulseRef.current * 0.18),
            false
          )
        ),
        outline: true,
        outlineColor: new CallbackProperty(
          () => new Color(1.0, 0.5, 0.25, 0.45 + pulseRef.current * 0.45),
          false
        ),
        outlineWidth: 2,
        height: 0,
      },
    })
  })
}

const removeWaveEntities = (viewer) => {
  removeEntityById(viewer, RING_ENTITY_ID)
  removeEntityById(viewer, SHOCKWAVE_ENTITY_ID)
  viewer.entities.values
    .filter((entity) => {
      const id = String(entity.id)
      return id.startsWith(WAVE_TRAIN_PREFIX) || id.startsWith(EPICENTER_PULSE_PREFIX)
    })
    .forEach((entity) => viewer.entities.remove(entity))
}

export default function TsunamiVisualization({
  viewerRef,
  simState,
  epicenter,
  tsunamiOptions,
  impactPoints,
  seekMs,
  isPickMode = false,
  onEpicenterChange,
  onImpactSummaryChange,
  onSimDone,
  onStatsChange,
}) {
  const modelRef = useRef(null)
  const startTimestampRef = useRef(null)
  const pausedElapsedRef = useRef(0)
  const elapsedMsRef = useRef(0)
  const rafIdRef = useRef(null)
  const lastSummaryReportMsRef = useRef(-1)
  const radiusRef = useRef(0)
  const pulseRef = useRef(0)
  const simStateRef = useRef(simState)
  const prevSimStateRef = useRef('idle')
  const configKeyRef = useRef('')
  const isPickModeRef = useRef(isPickMode)
  const impactPointsRef = useRef(impactPoints)
  const epicenterRef = useRef(epicenter)
  const runupLayerRef = useRef(null)

  const getRunupLayer = (viewer) => {
    if (!runupLayerRef.current || runupLayerRef.current.viewer !== viewer) {
      runupLayerRef.current?.clear()
      runupLayerRef.current = new TsunamiRunupPrimitiveLayer(viewer)
    }
    return runupLayerRef.current
  }

  useEffect(() => {
    epicenterRef.current = epicenter
  }, [epicenter])

  useEffect(() => {
    simStateRef.current = simState
  }, [simState])

  useEffect(() => {
    isPickModeRef.current = isPickMode
  }, [isPickMode])

  useEffect(() => {
    impactPointsRef.current = impactPoints
  }, [impactPoints])

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer || !isPickMode) return undefined

    const handler = new ScreenSpaceEventHandler(viewer.canvas)
    handler.setInputAction((event) => {
      if (!isPickModeRef.current) return

      const ray = viewer.camera.getPickRay(event.position)
      const point = viewer.scene.globe.pick(ray, viewer.scene)
      if (!point) return

      const carto = Ellipsoid.WGS84.cartesianToCartographic(point)
      onEpicenterChange?.({
        id: 'custom',
        label: '사용자 지정',
        lat: CesiumMath.toDegrees(carto.latitude),
        lon: CesiumMath.toDegrees(carto.longitude),
      })
    }, ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      if (!handler.isDestroyed()) handler.destroy()
    }
  }, [viewerRef, isPickMode, onEpicenterChange])

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    removeEntityById(viewer, EPICENTER_ENTITY_ID)
    createEpicenterEntity(viewer, epicenter)
    syncCoastalEntities(viewer, impactPoints, null, epicenter)
    viewer.scene.requestRender()

    return () => {
      if (!viewer.isDestroyed?.()) {
        removeEntityById(viewer, EPICENTER_ENTITY_ID)
        removeCoastalEntities(viewer)
        runupLayerRef.current?.clear()
      }
    }
  }, [viewerRef, epicenter, impactPoints])

  const reportSummary = (viewer, model, elapsed) => {
    const summary = model.getImpactSummary(elapsed, impactPointsRef.current)
    radiusRef.current = summary.ringRadiusM
    syncCoastalEntities(viewer, impactPointsRef.current, summary, epicenterRef.current)
    getRunupLayer(viewer).sync(buildRunupSites(summary, epicenterRef.current))
    onImpactSummaryChange?.(summary)
    onStatsChange?.({ elapsedMs: elapsed, ringRadiusM: summary.ringRadiusM })
    viewer.scene.requestRender()
    return summary
  }

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    const stopRaf = () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }

    const removeRings = () => {
      removeWaveEntities(viewer)
      radiusRef.current = 0
      pulseRef.current = 0
    }

    const resetSimulation = () => {
      stopRaf()
      removeRings()
      modelRef.current = null
      startTimestampRef.current = null
      pausedElapsedRef.current = 0
      elapsedMsRef.current = 0
      lastSummaryReportMsRef.current = -1
      onImpactSummaryChange?.(null)
      onStatsChange?.({ elapsedMs: 0, ringRadiusM: 0 })
      syncCoastalEntities(viewer, impactPointsRef.current, null, epicenterRef.current)
      getRunupLayer(viewer).clear()
    }

    if (simState === 'idle') {
      resetSimulation()
      prevSimStateRef.current = 'idle'
      return undefined
    }

    const configKey = `${epicenter.lat},${epicenter.lon},${JSON.stringify(tsunamiOptions)}`
    const configChanged = configKeyRef.current !== configKey
    configKeyRef.current = configKey

    modelRef.current = new TsunamiWaveModel({ epicenter, ...tsunamiOptions })

    if (simState === 'paused') {
      pausedElapsedRef.current = elapsedMsRef.current
      stopRaf()
      prevSimStateRef.current = 'paused'
      return undefined
    }

    if (simState === 'done') {
      stopRaf()
      prevSimStateRef.current = 'done'
      return undefined
    }

    const freshStart = prevSimStateRef.current === 'idle' || configChanged
    if (freshStart) {
      pausedElapsedRef.current = 0
      elapsedMsRef.current = 0
      lastSummaryReportMsRef.current = -1
      removeRings()
    }

    if (!viewer.entities.getById(RING_ENTITY_ID)) {
      createRingEntity(viewer, epicenter, radiusRef, pulseRef)
      createShockwaveEntity(viewer, epicenter, radiusRef, pulseRef)
      createWaveTrainEntities(viewer, epicenter, radiusRef, pulseRef)
      createEpicenterPulseEntities(viewer, epicenter, pulseRef)
    } else {
      const ring = viewer.entities.getById(RING_ENTITY_ID)
      if (ring) ring.position = positionFromLonLat(epicenter.lon, epicenter.lat)
      const sw = viewer.entities.getById(SHOCKWAVE_ENTITY_ID)
      if (sw) sw.position = positionFromLonLat(epicenter.lon, epicenter.lat)
      WAVE_TRAIN_RATIOS.forEach((_, index) => {
        const train = viewer.entities.getById(`${WAVE_TRAIN_PREFIX}${index}`)
        if (train) train.position = positionFromLonLat(epicenter.lon, epicenter.lat)
      })
      EPICENTER_PULSE_RADII_M.forEach((_, index) => {
        const pulse = viewer.entities.getById(`${EPICENTER_PULSE_PREFIX}${index}`)
        if (pulse) pulse.position = positionFromLonLat(epicenter.lon, epicenter.lat)
      })
    }

    startTimestampRef.current = null

    const tick = (timestamp) => {
      if (simStateRef.current !== 'running') return

      const model = modelRef.current
      if (!model) return

      if (startTimestampRef.current == null) {
        startTimestampRef.current = timestamp
      }

      const elapsed = pausedElapsedRef.current + (timestamp - startTimestampRef.current)
      elapsedMsRef.current = elapsed
      pulseRef.current = (Math.sin(elapsed * 0.011) + 1) / 2
      viewer.scene.requestRender()

      if (
        elapsed - lastSummaryReportMsRef.current >= SUMMARY_REPORT_INTERVAL_MS
        || lastSummaryReportMsRef.current < 0
      ) {
        lastSummaryReportMsRef.current = elapsed
        const summary = reportSummary(viewer, model, elapsed)

        if (model.isSimulationComplete(elapsed)) {
          onSimDone?.()
          return
        }
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    prevSimStateRef.current = 'running'

    return () => {
      stopRaf()
    }
  }, [
    viewerRef,
    simState,
    epicenter,
    tsunamiOptions,
    onImpactSummaryChange,
    onSimDone,
    onStatsChange,
  ])

  useEffect(() => {
    if (seekMs == null) return
    const viewer = getViewer(viewerRef)
    const model = modelRef.current
    if (!viewer || !model) return

    if (!viewer.entities.getById(RING_ENTITY_ID)) {
      createRingEntity(viewer, epicenter, radiusRef, pulseRef)
      createShockwaveEntity(viewer, epicenter, radiusRef, pulseRef)
      createWaveTrainEntities(viewer, epicenter, radiusRef, pulseRef)
      createEpicenterPulseEntities(viewer, epicenter, pulseRef)
    }

    pausedElapsedRef.current = seekMs
    elapsedMsRef.current = seekMs
    pulseRef.current = 0
    lastSummaryReportMsRef.current = seekMs
    reportSummary(viewer, model, seekMs)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekMs])

  return null
}
