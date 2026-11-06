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
import { EarthquakeWaveModel, getMMIColor, getMMILabel, getShakeParams } from '../../../physics/EarthquakeWaveModel'
import { startCameraShakeFromParams } from '../utils/cameraShake'
import { syncMMILayer, clearMMILayer } from '../utils/earthquakeMMILayer'
import { syncBuildingEffects, clearBuildingEffects } from '../utils/earthquakeBuildingEffects'
import { syncCrackLines, clearCrackLines } from '../utils/earthquakeCrackLines'
import {
  syncLiquefactionLayer,
  clearLiquefactionLayer,
  estimateLiquefactionAreaKm2,
} from '../utils/earthquakeLiquefactionLayer'
import { computeMMIBounds } from '../utils/earthquakeMMILayer'
import { resolveSimulationEvent } from '../constants/earthquakeAftershocks'

/** Cesium 라벨 폰트 — 앱 UI 서체와 통일 */
const MAP_LABEL_FONT = "'Pretendard Variable', Pretendard, 'Apple SD Gothic Neo', sans-serif"

const EPICENTER_ENTITY_ID = 'eq-epicenter'
const AFTERSHOCK_ENTITY_ID = 'eq-aftershock-active'
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

function createAftershockEntity(viewer, epicenter, label) {
  removeById(viewer, AFTERSHOCK_ENTITY_ID)
  viewer.entities.add({
    id: AFTERSHOCK_ENTITY_ID,
    position: positionProp(epicenter.lon, epicenter.lat),
    point: {
      pixelSize: 11,
      color: Color.fromCssColorString('#FF9500'),
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: label ?? '여진',
      font: `600 11px ${MAP_LABEL_FONT}`,
      pixelOffset: new Cartesian2(0, -22),
      fillColor: Color.fromCssColorString('#FF9500'),
      outlineColor: Color.fromCssColorString('#0b0e12'),
      outlineWidth: 2,
      style: LabelStyle.FILL_AND_OUTLINE,
    },
  })
}

function removeAftershockEntity(viewer) {
  removeById(viewer, AFTERSHOCK_ENTITY_ID)
}

function modelFromEvent(event) {
  return new EarthquakeWaveModel({
    epicenter: event.epicenter,
    depthKm: event.depthKm,
    magnitude: event.magnitude,
    timeScale: event.timeScale,
    maxPropagationKm: event.maxPropagationKm,
  })
}

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
      font: `600 12px ${MAP_LABEL_FONT}`,
      pixelOffset: new Cartesian2(0, -26),
      fillColor: Color.WHITE,
      outlineColor: Color.fromCssColorString('#0b0e12'),
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
      ? Color.fromCssColorString(getMMIColor(city.mmi))
      : city.pWaveReached
        ? Color.fromCssColorString('#AAAAAA')
        : Color.fromCssColorString('#6c7380')

    const labelText = city.sWaveReached
      ? `${city.label} MMI ${city.mmiLabel}`
      : city.pWaveReached
        ? `${city.label} P파 도달`
        : city.label

    const labelColor = city.sWaveReached
      ? Color.fromCssColorString(getMMIColor(city.mmi))
      : city.pWaveReached
        ? Color.fromCssColorString('#CCCCCC')
        : Color.fromCssColorString('#a1a8b3')

    if (!existing) {
      viewer.entities.add({
        id: entityId,
        position: positionProp(city.lon, city.lat),
        point: {
          pixelSize: city.sWaveReached ? 12 : city.pWaveReached ? 9 : 7,
          color,
          outlineColor: Color.fromCssColorString('#0b0e12'),
          outlineWidth: 1,
        },
        label: {
          text: labelText,
          font: `500 11px ${MAP_LABEL_FONT}`,
          pixelOffset: new Cartesian2(0, -20),
          fillColor: labelColor,
          outlineColor: Color.fromCssColorString('#0b0e12'),
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

// ─── 컴포넌트 ────────────────────────────────────────────────────

export default function EarthquakeVisualization({
  viewerRef,
  layerInstancesRef,
  layerVisibility,
  simState,
  epicenter,
  options,
  cities,
  seekMs,
  aftershockPlan = [],
  mainDurationMs = 0,
  totalSimMs = 0,
  isPickMode = false,
  onEpicenterChange,
  onImpactSummaryChange,
  onSimDone,
  onStatsChange,
  onCameraShake,
  onAftershockChange,
}) {
  const modelRef = useRef(null)
  const activeEventRef = useRef(null)
  const aftershockPlanRef = useRef(aftershockPlan)
  const mainDurationMsRef = useRef(mainDurationMs)
  const totalSimMsRef = useRef(totalSimMs)
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
  const mmiCacheRef = useRef({})
  const buildingCacheRef = useRef({})
  const crackCacheRef = useRef({})
  const liqCacheRef = useRef({})
  const mainSummaryCacheRef = useRef({ key: null, summary: null })
  const layerVisibilityRef = useRef(layerVisibility)
  const ringEpicenterRef = useRef(epicenter)

  // ref 동기화
  useEffect(() => { aftershockPlanRef.current = aftershockPlan }, [aftershockPlan])
  useEffect(() => { mainDurationMsRef.current = mainDurationMs }, [mainDurationMs])
  useEffect(() => { totalSimMsRef.current = totalSimMs }, [totalSimMs])
  useEffect(() => { simStateRef.current = simState }, [simState])
  useEffect(() => { isPickModeRef.current = isPickMode }, [isPickMode])
  useEffect(() => { epicenterRef.current = epicenter }, [epicenter])
  useEffect(() => { citiesRef.current = cities }, [cities])
  useEffect(() => { layerVisibilityRef.current = layerVisibility }, [layerVisibility])


  const syncBuildingLayer = (summary, elapsed, state, eventEpicenter) => {
    const tileset = layerInstancesRef?.current?.osmBuildings
    if (!tileset) return

    if (state === 'idle') {
      clearBuildingEffects(tileset, buildingCacheRef.current)
      return
    }

    syncBuildingEffects(tileset, {
      epicenter: eventEpicenter ?? epicenter,
      sWaveRadiusKm: summary?.sWaveRadiusKm ?? 0,
      sWaveRadiusM: summary?.sWaveRadiusM ?? 0,
      magnitude: activeEventRef.current?.magnitude ?? options.magnitude,
      depthKm: options.depthKm,
      elapsedMs: elapsed,
      maxMMI: summary?.maxMMI ?? 0,
      simState: state,
      layerVisible: layerVisibilityRef.current?.osmBuildings !== false,
    }, buildingCacheRef.current)
  }

  // OSM 레이어 토글 시 건물 효과 동기화
  useEffect(() => {
    const tileset = layerInstancesRef?.current?.osmBuildings
    const model = modelRef.current
    if (!tileset || !model || simStateRef.current === 'idle') return

    const summary = model.getImpactSummary(elapsedMsRef.current, citiesRef.current)
    syncBuildingLayer(summary, elapsedMsRef.current, simStateRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerVisibility?.osmBuildings])

  const syncPhase4Effects = (viewer, model, event, summary, eventElapsed) => {
    if (!viewer) return

    if (event.type === 'aftershock') {
      createAftershockEntity(viewer, event.epicenter, event.aftershock?.label)
      onAftershockChange?.(event.aftershock)
      clearCrackLines(viewer, crackCacheRef.current)
      clearLiquefactionLayer(viewer, liqCacheRef.current)
      return
    }

    removeAftershockEntity(viewer)
    onAftershockChange?.(null)

    syncCrackLines(viewer, event.epicenter, {
      maxMMI: summary.maxMMI,
      sRadiusM: summary.sWaveRadiusM,
      type: event.type,
    }, crackCacheRef.current)

    syncLiquefactionLayer(viewer, model, {
      elapsedMs: eventElapsed,
      sRadiusM: summary.sWaveRadiusM,
      maxMMI: summary.maxMMI,
      epicenter: event.epicenter,
      maxPropagationKm: event.maxPropagationKm,
    }, liqCacheRef.current)
  }

  const augmentSummary = (summary, model, event, eventElapsed) => {
    const bounds = computeMMIBounds(event.epicenter, event.maxPropagationKm)
    const liquefactionAreaKm2 = event.type === 'main' && summary.maxMMI >= 6
      ? estimateLiquefactionAreaKm2(model, eventElapsed, bounds)
      : 0

    return {
      ...summary,
      eventType: event.type,
      aftershockLabel: event.aftershock?.label ?? null,
      liquefactionAreaKm2,
    }
  }

  const applySimulationFrame = (viewer, globalElapsed, state) => {
    const event = resolveSimulationEvent(
      globalElapsed,
      epicenterRef.current,
      options,
      aftershockPlanRef.current,
      mainDurationMsRef.current,
    )
    activeEventRef.current = event

    if (event.type === 'complete' || globalElapsed >= totalSimMsRef.current) {
      return { done: true, event, summary: null, eventElapsed: 0 }
    }

    const model = modelFromEvent(event)
    modelRef.current = model
    const eventElapsed = event.eventElapsedMs
    ringEpicenterRef.current = event.epicenter

    pRadiusRef.current = model.getPWaveRadius(eventElapsed)
    sRadiusRef.current = model.getSWaveRadius(eventElapsed)

    const summary = augmentSummary(
      model.getImpactSummary(eventElapsed, citiesRef.current),
      model,
      event,
      eventElapsed,
    )

    syncCityEntities(viewer, summary)
    syncMMILayer(viewer, model, {
      elapsedMs: eventElapsed,
      affectedCount: summary.affectedCount,
      sRadiusM: summary.sWaveRadiusM,
      epicenter: event.epicenter,
      maxPropagationKm: event.maxPropagationKm,
    }, mmiCacheRef.current)
    syncBuildingLayer(summary, eventElapsed, state, event.epicenter)
    syncPhase4Effects(viewer, model, event, summary, eventElapsed)

    return { done: false, event, summary, panelSummary: getPanelSummary(event, summary), eventElapsed, model }
  }

  /**
   * 패널용 피해 요약 — 여진 구간에도 본진 전파 완료 시점의 결과를 유지한다.
   * (여진은 전파 범위·규모가 작아 그대로 보여주면 본진 피해가 줄어든 것처럼 보인다)
   */
  const getPanelSummary = (event, summary) => {
    if (event.type !== 'aftershock') return summary

    const mainEvent = resolveSimulationEvent(
      mainDurationMsRef.current,
      epicenterRef.current,
      options,
      [],
      mainDurationMsRef.current,
    )
    const key = `${mainEvent.epicenter.lat},${mainEvent.epicenter.lon},${mainEvent.magnitude},${mainEvent.depthKm}`
    if (mainSummaryCacheRef.current.key !== key) {
      const mainModel = modelFromEvent(mainEvent)
      mainSummaryCacheRef.current = {
        key,
        summary: augmentSummary(
          mainModel.getImpactSummary(mainEvent.eventElapsedMs, citiesRef.current),
          mainModel,
          mainEvent,
          mainEvent.eventElapsedMs,
        ),
      }
    }
    return {
      ...mainSummaryCacheRef.current.summary,
      eventType: 'aftershock',
      aftershockLabel: event.aftershock?.label ?? null,
    }
  }

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

    // 캐시 객체는 컴포넌트 수명 동안 동일 — cleanup에서 쓰도록 고정
    const mmiCache = mmiCacheRef.current
    const crackCache = crackCacheRef.current
    const liqCache = liqCacheRef.current
    const buildingCache = buildingCacheRef.current
    const layerInstances = layerInstancesRef?.current

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
      removeAftershockEntity(viewer)
      clearCrackLines(viewer, crackCacheRef.current)
      clearLiquefactionLayer(viewer, liqCacheRef.current)
      pRadiusRef.current = 0
      sRadiusRef.current = 0
      modelRef.current = null
      activeEventRef.current = null
      startTimestampRef.current = null
      pausedElapsedRef.current = 0
      elapsedMsRef.current = 0
      lastSummaryMsRef.current = -1
      shakeFiredRef.current = false
      clearMMILayer(viewer, mmiCacheRef.current)
      syncBuildingLayer(null, 0, 'idle')
      onAftershockChange?.(null)
      onImpactSummaryChange?.(null)
      onStatsChange?.({ elapsedMs: 0, pRadiusM: 0, sRadiusM: 0 })
    }

    if (simState === 'idle') {
      resetSim()
      prevSimStateRef.current = 'idle'
      return undefined
    }

    if (simState === 'paused') {
      pausedElapsedRef.current = elapsedMsRef.current
      const frame = applySimulationFrame(viewer, elapsedMsRef.current, 'paused')
      if (frame.summary) {
        onImpactSummaryChange?.(frame.panelSummary)
        onStatsChange?.({
          elapsedMs: elapsedMsRef.current,
          pRadiusM: frame.summary.pWaveRadiusM,
          sRadiusM: frame.summary.sWaveRadiusM,
        })
      }
      stopRaf()
      prevSimStateRef.current = 'paused'
      return undefined
    }

    if (simState === 'done') {
      const frame = applySimulationFrame(viewer, elapsedMsRef.current, 'done')
      if (frame.summary) syncBuildingLayer(frame.summary, elapsedMsRef.current, 'done', frame.event?.epicenter)
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
    let lastEventType = 'main'

    const tick = (timestamp) => {
      if (simStateRef.current !== 'running') return

      if (startTimestampRef.current == null) {
        startTimestampRef.current = timestamp
      }

      const elapsed = pausedElapsedRef.current + (timestamp - startTimestampRef.current)
      elapsedMsRef.current = elapsed
      viewer.scene.requestRender()

      if (
        elapsed - lastSummaryMsRef.current >= SUMMARY_INTERVAL_MS
        || lastSummaryMsRef.current < 0
      ) {
        lastSummaryMsRef.current = elapsed
        const frame = applySimulationFrame(viewer, elapsed, 'running')

        if (frame.event.type !== lastEventType) {
          createPWaveRing(viewer, frame.event.epicenter, pRadiusRef)
          createSWaveRing(viewer, frame.event.epicenter, sRadiusRef)
          lastEventType = frame.event.type
        }

        if (frame.done) {
          onSimDone?.()
          return
        }

        const { summary, model, eventElapsed } = frame
        onImpactSummaryChange?.(frame.panelSummary)
        onStatsChange?.({
          elapsedMs: elapsed,
          pRadiusM: summary.pWaveRadiusM,
          sRadiusM: summary.sWaveRadiusM,
        })

        // S파 카메라 도달 → 쉐이크 (본진 1회)
        if (!shakeFiredRef.current && frame.event.type === 'main') {
          const cam = viewer.camera.positionCartographic
          if (cam && model) {
            const camLat = CesiumMath.toDegrees(cam.latitude)
            const camLon = CesiumMath.toDegrees(cam.longitude)
            const sArr = model.getSWaveArrivalMs(camLat, camLon)
            if (Number.isFinite(sArr) && eventElapsed >= sArr) {
              shakeFiredRef.current = true
              const mmi = model.getMMI(camLat, camLon)
              const params = getShakeParams(mmi)
              stopShake()
              shakeStopRef.current = startCameraShakeFromParams(viewer, params)
              onCameraShake?.({ mmi, mmiLabel: getMMILabel(mmi) })
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    prevSimStateRef.current = 'running'

    return () => {
      stopRaf()
      if (!viewer.isDestroyed?.()) {
        clearMMILayer(viewer, mmiCache)
        clearCrackLines(viewer, crackCache)
        clearLiquefactionLayer(viewer, liqCache)
        removeAftershockEntity(viewer)
        const tileset = layerInstances?.osmBuildings
        if (tileset) clearBuildingEffects(tileset, buildingCache)
      }
    }
  // applySimulationFrame·syncBuildingLayer는 매 렌더 재생성되는 함수로, 최신 값은 ref로 읽는다.
  // 의존성에 넣으면 매 렌더마다 RAF 루프가 재시작되므로 의도적으로 제외한다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewerRef,
    layerInstancesRef,
    simState,
    epicenter,
    options,
    onImpactSummaryChange,
    onSimDone,
    onStatsChange,
    onCameraShake,
    onAftershockChange,
  ])

  // ── 스크러빙 ───────────────────────────────────────────────────
  useEffect(() => {
    if (seekMs == null) return
    const viewer = getViewer(viewerRef)
    if (!viewer) return

    pausedElapsedRef.current = seekMs
    elapsedMsRef.current = seekMs
    lastSummaryMsRef.current = seekMs

    const frame = applySimulationFrame(viewer, seekMs, 'paused')
    if (frame.done || !frame.summary) return

    createPWaveRing(viewer, frame.event.epicenter, pRadiusRef)
    createSWaveRing(viewer, frame.event.epicenter, sRadiusRef)

    onImpactSummaryChange?.(frame.panelSummary)
    onStatsChange?.({
      elapsedMs: seekMs,
      pRadiusM: frame.summary.pWaveRadiusM,
      sRadiusM: frame.summary.sWaveRadiusM,
    })
    viewer.scene.requestRender()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekMs])

  return null
}
