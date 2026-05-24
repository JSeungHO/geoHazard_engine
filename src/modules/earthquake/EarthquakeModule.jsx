/**
 * EarthquakeModule.jsx
 * 지진 모듈 최상위 — simState, epicenter, 카메라, seek 조율
 * 참조: earthquake-plan.md §7.1
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import {
  Ion,
  Cartesian3,
  BoundingSphere,
  HeadingPitchRange,
  Math as CesiumMath,
} from 'cesium'
import CesiumMapViewer from '../../components/CesiumMapViewer'
import EarthquakeMainUI from './components/EarthquakeMainUI'
import EarthquakeVisualization from './components/EarthquakeVisualization'
import SceneLayersPanel from '../../components/SceneLayersPanel'
import SceneLayerController from '../../components/SceneLayerController'
import MapStatusBar from '../../components/MapStatusBar'
import SimulationErrorBoundary from '../../components/SimulationErrorBoundary'
import { DEFAULT_LAYER_VISIBILITY } from '../../constants/sceneLayers'
import {
  DEFAULT_EPICENTER,
  DEFAULT_EARTHQUAKE_OPTIONS,
  EARTHQUAKE_DEFAULT_VIEW,
  EARTHQUAKE_IDLE_VIEW_RANGE_FACTOR,
} from './constants/earthquakePresets'
import { EARTHQUAKE_IMPACT_CITIES } from './constants/earthquakeImpactCities'
import { EarthquakeWaveModel } from '../../physics/EarthquakeWaveModel'
import {
  buildAftershockPlan,
  getTotalSimulationMs,
  resolveSimulationEvent,
} from './constants/earthquakeAftershocks'
import useMapLayout from '../flood/hooks/useMapLayout'
import './EarthquakeModule.css'

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

/** 진앙 look-at — idle·프리셋 선택 시 (한반도 + 진앙 마커) */
const flyToIdleView = (viewer, epicenter, maxPropagationKm, duration = 1.8) => {
  if (!viewer || viewer.isDestroyed?.()) return
  const target = Cartesian3.fromDegrees(epicenter.lon, epicenter.lat, 0)
  const rangeM = Math.max(maxPropagationKm * 1000 * EARTHQUAKE_IDLE_VIEW_RANGE_FACTOR, 620_000)
  viewer.camera.flyToBoundingSphere(new BoundingSphere(target, 50), {
    duration,
    offset: new HeadingPitchRange(
      CesiumMath.toRadians(0),
      CesiumMath.toRadians(-58),
      rangeM,
    ),
  })
}

/** 시뮬 시작 시 — 전파 ring 전체가 보이도록 약간 줌아웃 */
const flyToEpicenterView = (viewer, epicenter, maxPropagationKm) => {
  if (!viewer || viewer.isDestroyed?.()) return
  const target = Cartesian3.fromDegrees(epicenter.lon, epicenter.lat, 0)
  const rangeM = Math.max(maxPropagationKm * 1000 * 1.05, 720_000)
  viewer.camera.flyToBoundingSphere(new BoundingSphere(target, 50), {
    duration: 2.2,
    offset: new HeadingPitchRange(
      CesiumMath.toRadians(0),
      CesiumMath.toRadians(-62),
      rangeM,
    ),
  })
}

export default function EarthquakeModule() {
  const viewerRef = useRef(null)
  const mapContainerRef = useRef(null)

  const [isViewerReady, setIsViewerReady] = useState(false)
  const [simState, setSimState] = useState('idle')
  const [epicenter, setEpicenter] = useState(DEFAULT_EPICENTER)
  const [options, setOptions] = useState(DEFAULT_EARTHQUAKE_OPTIONS)
  const [layerVisibility, setLayerVisibility] = useState(DEFAULT_LAYER_VISIBILITY)
  const [epochKey, setEpochKey] = useState(0)
  const [impactSummary, setImpactSummary] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pRadiusM, setPRadiusM] = useState(0)
  const [sRadiusM, setSRadiusM] = useState(0)
  const [seekMs, setSeekMs] = useState(null)
  const [isPickMode, setIsPickMode] = useState(false)
  const [shakeAlert, setShakeAlert] = useState(null)
  const [activeAftershock, setActiveAftershock] = useState(null)

  const prevSimStateRef = useRef('idle')
  const shakeAlertTimerRef = useRef(null)
  const layerInstancesRef = useRef({})

  // ── phase 계산 ──────────────────────────────────────────────────
  const phase = useMemo(() => {
    if (simState === 'idle') return 'idle'
    if (simState === 'done') return 'done'
    if (activeAftershock) return 'aftershock'
    if (shakeAlert) return 'shaking'
    const firstSArrival = impactSummary?.firstSArrivalMs ?? null
    const affectedCount = impactSummary?.affectedCount ?? 0
    if (impactSummary?.liquefactionAreaKm2 > 0) return 'liquefaction'
    if (affectedCount > 0) return 'swave'
    if (firstSArrival != null && elapsedMs >= firstSArrival) return 'swave'
    return 'pwave'
  }, [simState, elapsedMs, impactSummary, shakeAlert, activeAftershock])

  const mainDurationMs = useMemo(() => {
    const model = new EarthquakeWaveModel({ epicenter, ...options })
    return model.getTotalDurationMs()
  }, [epicenter, options])

  const aftershockPlan = useMemo(
    () => buildAftershockPlan(epicenter, options, mainDurationMs),
    [epicenter, options, mainDurationMs],
  )

  // ── totalMs ─────────────────────────────────────────────────────
  const totalMs = useMemo(
    () => getTotalSimulationMs(mainDurationMs, aftershockPlan),
    [mainDurationMs, aftershockPlan],
  )

  // ── 카메라: 탭 진입·idle 프리셋 변경 ─────────────────────────────
  useEffect(() => {
    if (!isViewerReady || simState !== 'idle') return
    flyToIdleView(viewerRef.current, epicenter, options.maxPropagationKm)
  }, [isViewerReady, simState, epicenter, options.maxPropagationKm])

  // ── 카메라: idle→running 전환 시 ────────────────────────────────
  useEffect(() => {
    if (simState !== 'running') return
    if (prevSimStateRef.current !== 'idle') return
    flyToEpicenterView(viewerRef.current, epicenter, options.maxPropagationKm)
  }, [simState, epicenter, options.maxPropagationKm])

  useEffect(() => {
    prevSimStateRef.current = simState
  }, [simState])

  // ── 핸들러 ─────────────────────────────────────────────────────

  const handleViewerReady = useCallback(() => {
    setIsViewerReady(true)
  }, [])

  const handleOptionsChange = useCallback((key, value) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleLayerVisibilityChange = useCallback((layerId, visible) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }))
  }, [])

  const handleEpicenterChange = useCallback((next) => {
    setEpicenter(next)
    // 프리셋에 magnitude/depthKm 포함 시 options 동기화
    if (next.magnitude != null || next.depthKm != null) {
      setOptions((prev) => ({
        ...prev,
        ...(next.depthKm != null ? { depthKm: next.depthKm } : {}),
        ...(next.magnitude != null ? { magnitude: next.magnitude } : {}),
      }))
    }
    setIsPickMode(false)
  }, [])

  const handlePickEpicenter = useCallback(() => {
    setIsPickMode(true)
  }, [])

  const handleStart = useCallback(() => {
    setSeekMs(null)
    setSimState('running')
  }, [])

  const handlePause = useCallback(() => {
    setSimState('paused')
  }, [])

  const handleReset = useCallback(() => {
    setSimState('idle')
    setImpactSummary(null)
    setElapsedMs(0)
    setPRadiusM(0)
    setSRadiusM(0)
    setSeekMs(null)
    setIsPickMode(false)
    setShakeAlert(null)
    setActiveAftershock(null)
    setEpicenter(DEFAULT_EPICENTER)
    setOptions(DEFAULT_EARTHQUAKE_OPTIONS)
    setEpochKey((k) => k + 1)
    flyToIdleView(viewerRef.current, DEFAULT_EPICENTER, DEFAULT_EARTHQUAKE_OPTIONS.maxPropagationKm)
  }, [])

  const handleSimDone = useCallback(() => {
    setSimState('done')
  }, [])

  const handleImpactSummaryChange = useCallback((summary) => {
    setImpactSummary(summary)
  }, [])

  const handleStatsChange = useCallback(({ elapsedMs: e, pRadiusM: p, sRadiusM: s }) => {
    setElapsedMs(e)
    setPRadiusM(p)
    setSRadiusM(s)
  }, [])

  const handleSeek = useCallback((ms) => {
    setSimState('paused')
    setSeekMs(ms)
    setElapsedMs(ms)
  }, [])

  const handleCameraShake = useCallback(({ mmi, mmiLabel }) => {
    // 타이머 초기화 후 2초간 표시
    clearTimeout(shakeAlertTimerRef.current)
    setShakeAlert({ mmi, mmiLabel })
    shakeAlertTimerRef.current = setTimeout(() => {
      setShakeAlert(null)
    }, 2_000)
  }, [])

  const handleFlyToOverview = useCallback(() => {
    flyToIdleView(viewerRef.current, epicenter, options.maxPropagationKm, 1.5)
  }, [epicenter, options.maxPropagationKm])

  useMapLayout(mapContainerRef, viewerRef, isViewerReady)

  // MapStatusBar pill 텍스트
  const statusLabel = useMemo(() => {
    if (simState === 'idle') return '지진 대기'
    if (activeAftershock) return `🟠 ${activeAftershock.label}`
    if (shakeAlert) return '🔴 흔들림 감지'
    if (simState === 'running') return '⚫ 지진파 전파 중'
    if (simState === 'paused') return '일시정지'
    return '전파 완료'
  }, [simState, shakeAlert, activeAftershock])

  return (
    <div className="earthquake-module">
      <EarthquakeMainUI
        simState={simState}
        phase={phase}
        epicenter={epicenter}
        options={options}
        impactSummary={impactSummary}
        elapsedMs={elapsedMs}
        pRadiusM={pRadiusM}
        sRadiusM={sRadiusM}
        totalMs={totalMs}
        isPickMode={isPickMode}
        shakeAlert={shakeAlert}
        aftershockPlan={aftershockPlan}
        activeAftershock={activeAftershock}
        onEpicenterChange={handleEpicenterChange}
        onOptionsChange={handleOptionsChange}
        onPickEpicenter={handlePickEpicenter}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onSeek={handleSeek}
      />

      <div className="earthquake-module-stage">
        <div ref={mapContainerRef} className="earthquake-module-map">
          <CesiumMapViewer
            viewerRef={viewerRef}
            mapContainerRef={mapContainerRef}
            onViewerReady={handleViewerReady}
            initialLocation={EARTHQUAKE_DEFAULT_VIEW}
          />
          {isViewerReady && (
            <>
              <SimulationErrorBoundary
                key={epochKey}
                onRetry={() => setEpochKey((k) => k + 1)}
              >
                <SceneLayerController
                  viewerRef={viewerRef}
                  layerVisibility={layerVisibility}
                  instancesRef={layerInstancesRef}
                />
                <EarthquakeVisualization
                  viewerRef={viewerRef}
                  layerInstancesRef={layerInstancesRef}
                  layerVisibility={layerVisibility}
                  simState={simState}
                  epicenter={epicenter}
                  options={options}
                  cities={EARTHQUAKE_IMPACT_CITIES}
                  seekMs={seekMs}
                  isPickMode={isPickMode}
                  aftershockPlan={aftershockPlan}
                  mainDurationMs={mainDurationMs}
                  totalSimMs={totalMs}
                  onAftershockChange={setActiveAftershock}
                  onEpicenterChange={handleEpicenterChange}
                  onImpactSummaryChange={handleImpactSummaryChange}
                  onSimDone={handleSimDone}
                  onStatsChange={handleStatsChange}
                  onCameraShake={handleCameraShake}
                />
              </SimulationErrorBoundary>
              <MapStatusBar
                viewerRef={viewerRef}
                isActive={isViewerReady}
                waterLevel={0}
                levelLabel={statusLabel}
              />
            </>
          )}
        </div>
      </div>

      <SceneLayersPanel
        layerVisibility={layerVisibility}
        onLayerVisibilityChange={handleLayerVisibilityChange}
        onFlyToGangnam={handleFlyToOverview}
        flyToLabel="진앙 조망"
      />
    </div>
  )
}
