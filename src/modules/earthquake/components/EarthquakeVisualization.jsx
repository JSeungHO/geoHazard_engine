/**
 * EarthquakeVisualization.jsx
 * P파·S파 ring Cesium Entity + 도시 마커 + 카메라 쉐이크
 * 참조: earthquake-plan.md §7.2, earthquake-ui.md
 */

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
import { EarthquakeWaveModel, getShakeParams } from '../../../physics/EarthquakeWaveModel'
import { startCameraShakeFromParams } from '../utils/cameraShake'

const EPICENTER_ENTITY_ID = 'eq-epicenter'
const PWAVE_RING_ID = 'eq-pwave-ring'
const SWAVE_RING_ID = 'eq-swave-ring'
const CITY_PREFIX = 'eq-city-'
const SUMMARY_INTERVAL_MS = 80

// P파 ring: 흰 점선 outline
const PWAVE_OUTLINE_COLOR = new Color(1.0, 1.0, 1.0, 0.85)
const PWAVE_FILL_COLOR = new Color(1.0, 1.0, 1.0, 0.03)
// S파 ring: 주황 solid outline
const SWAVE_OUTLINE_COLOR = new Color(0.98, 0.45, 0.09, 0.9)
const SWAVE_FILL_COLOR = new Color(0.98, 0.45, 0.09, 0.06)

const getViewer = (ref) => {
  const v = ref.current
  return (!v || v.isDestroyed?.()) ? null : v
}

const positionProp = (lon, lat) =>
  new ConstantPositionProperty(Cartesian3.fromDegrees(lon, lat, 0))

const removeById = (viewer, id) => {
  const e = viewer.entities.getById(id)
  if (e) viewer.entities.remove(e)
}

const removeCityMarkers = (viewer) => {
  viewer.entities.values
    .filter((e) => String(e.id).startsWith(CITY_PREFIX))
    .forEach((e) => viewer.entities.remove(e))
}

// ─── Entity 생성 ─────────────────────────────────────────────────

function createEpicenterEntity(viewer, epicenter) {
  removeById(viewer, EPICENTER_ENTITY_ID)
  viewer.entities.add({
    id: EPICENTER_ENTITY_ID,
    position: positionProp(epicenter.lon, epicenter.lat),
    point: {
      pixelSize: 14,
      color: Color.fromCssColorString('#FF3A3A'),
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: '진앙',
      font: 'bold 12px sans-serif',
      pixelOffset: new Cartesian2(0, -26),
      fillColor: Color.WHITE,
      outlineColor: Color.fromCssColorString('#1A1A2E'),
      outlineWidth: 2,
      style: LabelStyle.FILL_AND_OUTLINE,
    },
  })
}

function createPWaveRing(viewer, epicenter, pRadiusRef) {
  removeById(viewer, PWAVE_RING_ID)
  viewer.entities.add({
    id: PWAVE_RING_ID,
    position: positionProp(epicenter.lon, epicenter.lat),
    ellipse: {
      semiMajorAxis: new CallbackProperty(() => Math.max(pRadiusRef.current, 1000), false),
      semiMinorAxis: new CallbackProperty(() => Math.max(pRadiusRef.current, 1000), false),
      material: new ColorMaterialProperty(
        new CallbackProperty(() => PWAVE_FILL_COLOR, false)
      ),
      outline: true,
      outlineColor: new CallbackProperty(() => PWAVE_OUTLINE_COLOR, false),
      outlineWidth: 2,
      height: 0,
    },
  })
}

function createSWaveRing(viewer, epicenter, sRadiusRef) {
  removeById(viewer, SWAVE_RING_ID)
  viewer.entities.add({
    id: SWAVE_RING_ID,
    position: positionProp(epicenter.lon, epicenter.lat),
    ellipse: {
      semiMajorAxis: new CallbackProperty(() => Math.max(sRadiusRef.current, 1000), false),
      semiMinorAxis: new CallbackProperty(() => Math.max(sRadiusRef.current, 1000), false),
      material: new ColorMaterialProperty(
        new CallbackProperty(() => SWAVE_FILL_COLOR, false)
      ),
      outline: true,
      outlineColor: new CallbackProperty(() => SWAVE_OUTLINE_COLOR, false),
      outlineWidth: 3,
      height: 0,
    },
  })
}

function removeWaveRings(viewer) {
  removeById(viewer, PWAVE_RING_ID)
  removeById(viewer, SWAVE_RING_ID)
}

// ─── 도시 마커 동기화 ────────────────────────────────────────────

function syncCityEntities(viewer, summary) {
  if (!summary) return

  summary.cities.forEach((city) => {
    const entityId = `${CITY_PREFIX}${city.id}`
    const existing = viewer.entities.getById(entityId)

    const color = city.sWaveReached
      ? Color.fromCssColorString(mmiToColor(city.mmi))
      : city.pWaveReached
        ? Color.fromCssColorString('#AAAAAA')
        : Color.fromCssColorString('#555577')

    const labelText = city.sWaveReached
      ? `${city.label} MMI ${city.mmiLabel}`
      : city.pWaveReached
        ? `${city.label} P파 도달`
        : city.label

    const labelColor = city.sWaveReached
      ? Color.fromCssColorString(mmiToColor(city.mmi))
      : city.pWaveReached
        ? Color.fromCssColorString('#CCCCCC')
        : Color.fromCssColorString('#8888AA')

    if (!existing) {
      viewer.entities.add({
        id: entityId,
        position: positionProp(city.lon, city.lat),
        point: {
          pixelSize: city.sWaveReached ? 12 : city.pWaveReached ? 9 : 7,
          color,
          outlineColor: Color.fromCssColorString('#1A1A2E'),
          outlineWidth: 1,
        },
        label: {
          text: labelText,
          font: '11px sans-serif',
          pixelOffset: new Cartesian2(0, -20),
          fillColor: labelColor,
          outlineColor: Color.fromCssColorString('#1A1A2E'),
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    } else {
      existing.point.color = color
      existing.point.pixelSize = city.sWaveReached ? 12 : city.pWaveReached ? 9 : 7
      existing.label.text = labelText
      existing.label.fillColor = labelColor
    }
  })
}

/** MMI → 색상 hex */
function mmiToColor(mmi) {
  const clamped = Math.round(Math.max(1, Math.min(12, mmi)))
  if (clamped <= 3) return '#FFFFFF'
  if (clamped === 4) return '#8DD9F5'
  if (clamped === 5) return '#FFF87A'
  if (clamped === 6) return '#FFC700'
  if (clamped === 7) return '#FF8C00'
  if (clamped === 8) return '#FF4500'
  return '#CC0000'
}

// ─── 컴포넌트 ────────────────────────────────────────────────────

export default function EarthquakeVisualization({
  viewerRef,
  simState,
  epicenter,
  options,
  cities,
  seekMs,
  isPickMode = false,
  onEpicenterChange,
  onImpactSummaryChange,
  onSimDone,
  onStatsChange,
  onCameraShake,
}) {
  const modelRef = useRef(null)
  const startTimestampRef = useRef(null)
  const pausedElapsedRef = useRef(0)
  const elapsedMsRef = useRef(0)
  const rafIdRef = useRef(null)
  const lastSummaryMsRef = useRef(-1)
  const pRadiusRef = useRef(0)
  const sRadiusRef = useRef(0)
  const simStateRef = useRef(simState)
  const prevSimStateRef = useRef('idle')
  const isPickModeRef = useRef(isPickMode)
  const epicenterRef = useRef(epicenter)
  const citiesRef = useRef(cities)
  const shakeStopRef = useRef(null)
  const shakeFiredRef = useRef(false)

  // ref 동기화
  useEffect(() => { simStateRef.current = simState }, [simState])
  useEffect(() => { isPickModeRef.current = isPickMode }, [isPickMode])
  useEffect(() => { epicenterRef.current = epicenter }, [epicenter])
  useEffect(() => { citiesRef.current = cities }, [cities])

  // ── 지도 클릭으로 진앙 설정 ────────────────────────────────────
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

    return () => { if (!handler.isDestroyed()) handler.destroy() }
  }, [viewerRef, isPickMode, onEpicenterChange])

  // ── 진앙 마커 + 초기 도시 마커 ──────────────────────────────────
  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    createEpicenterEntity(viewer, epicenter)
    viewer.scene.requestRender()

    return () => {
      if (!viewer.isDestroyed?.()) {
        removeById(viewer, EPICENTER_ENTITY_ID)
        removeCityMarkers(viewer)
      }
    }
  }, [viewerRef, epicenter])

  // ── 시뮬레이션 주 루프 ─────────────────────────────────────────
  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return undefined

    const stopRaf = () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }

    const stopShake = () => {
      shakeStopRef.current?.()
      shakeStopRef.current = null
    }

    const resetSim = () => {
      stopRaf()
      stopShake()
      removeWaveRings(viewer)
      removeCityMarkers(viewer)
      pRadiusRef.current = 0
      sRadiusRef.current = 0
      modelRef.current = null
      startTimestampRef.current = null
      pausedElapsedRef.current = 0
      elapsedMsRef.current = 0
      lastSummaryMsRef.current = -1
      shakeFiredRef.current = false
      onImpactSummaryChange?.(null)
      onStatsChange?.({ elapsedMs: 0, pRadiusM: 0, sRadiusM: 0 })
    }

    if (simState === 'idle') {
      resetSim()
      prevSimStateRef.current = 'idle'
      return undefined
    }

    modelRef.current = new EarthquakeWaveModel({ epicenter, ...options })

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

    // running
    const freshStart = prevSimStateRef.current === 'idle'
    if (freshStart) {
      pausedElapsedRef.current = 0
      elapsedMsRef.current = 0
      lastSummaryMsRef.current = -1
      shakeFiredRef.current = false
      removeWaveRings(viewer)
    }

    createPWaveRing(viewer, epicenter, pRadiusRef)
    createSWaveRing(viewer, epicenter, sRadiusRef)
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

      pRadiusRef.current = model.getPWaveRadius(elapsed)
      sRadiusRef.current = model.getSWaveRadius(elapsed)
      viewer.scene.requestRender()

      if (
        elapsed - lastSummaryMsRef.current >= SUMMARY_INTERVAL_MS
        || lastSummaryMsRef.current < 0
      ) {
        lastSummaryMsRef.current = elapsed
        const summary = model.getImpactSummary(elapsed, citiesRef.current)
        syncCityEntities(viewer, summary)
        onImpactSummaryChange?.(summary)
        onStatsChange?.({
          elapsedMs: elapsed,
          pRadiusM: summary.pWaveRadiusM,
          sRadiusM: summary.sWaveRadiusM,
        })

        // S파 카메라 위치 도달 → 쉐이크 (1회)
        if (!shakeFiredRef.current) {
          const cam = viewer.camera.positionCartographic
          if (cam) {
            const camLat = CesiumMath.toDegrees(cam.latitude)
            const camLon = CesiumMath.toDegrees(cam.longitude)
            const sArr = model.getSWaveArrivalMs(camLat, camLon)
            if (Number.isFinite(sArr) && elapsed >= sArr) {
              shakeFiredRef.current = true
              const mmi = model.getMMI(camLat, camLon)
              const params = getShakeParams(mmi)
              stopShake()
              shakeStopRef.current = startCameraShakeFromParams(viewer, params)
              onCameraShake?.({ mmi, mmiLabel: summary.cities[0]?.mmiLabel ?? '' })
            }
          }
        }

        if (model.isSimulationComplete(elapsed)) {
          onSimDone?.()
          return
        }
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    prevSimStateRef.current = 'running'

    return () => { stopRaf() }
  }, [
    viewerRef,
    simState,
    epicenter,
    options,
    onImpactSummaryChange,
    onSimDone,
    onStatsChange,
    onCameraShake,
  ])

  // ── 스크러빙 ───────────────────────────────────────────────────
  useEffect(() => {
    if (seekMs == null) return
    const viewer = getViewer(viewerRef)
    const model = modelRef.current
    if (!viewer || !model) return

    if (!viewer.entities.getById(PWAVE_RING_ID)) {
      createPWaveRing(viewer, epicenter, pRadiusRef)
    }
    if (!viewer.entities.getById(SWAVE_RING_ID)) {
      createSWaveRing(viewer, epicenter, sRadiusRef)
    }

    pausedElapsedRef.current = seekMs
    elapsedMsRef.current = seekMs
    pRadiusRef.current = model.getPWaveRadius(seekMs)
    sRadiusRef.current = model.getSWaveRadius(seekMs)
    lastSummaryMsRef.current = seekMs

    const summary = model.getImpactSummary(seekMs, citiesRef.current)
    syncCityEntities(viewer, summary)
    onImpactSummaryChange?.(summary)
    onStatsChange?.({
      elapsedMs: seekMs,
      pRadiusM: summary.pWaveRadiusM,
      sRadiusM: summary.sWaveRadiusM,
    })
    viewer.scene.requestRender()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekMs])

  return null
}
