import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Ion, Cartesian3, BoundingSphere, HeadingPitchRange, Math as CesiumMath } from 'cesium'
import CesiumMapViewer from '../../components/CesiumMapViewer'
import TsunamiMainUI from './components/TsunamiMainUI'
import TsunamiVisualization from './components/TsunamiVisualization'
import SceneLayersPanel from '../../components/SceneLayersPanel'
import SceneLayerController from '../../components/SceneLayerController'
import MapStatusBar from '../../components/MapStatusBar'
import SimulationErrorBoundary from '../../components/SimulationErrorBoundary'
import { DEFAULT_LAYER_VISIBILITY } from '../../constants/sceneLayers'
import { DEFAULT_EPICENTER, DEFAULT_TSUNAMI_OPTIONS } from './constants/tsunamiPresets'
import { getCoastalWaveCamera } from './constants/coastalSurgeLayout'
import {
  getImpactPointsForEpicenter,
  TSUNAMI_DEFAULT_VIEW,
} from './constants/coastalImpactPoints'
import { TsunamiWaveModel, haversineDistanceM } from '../../physics/TsunamiWaveModel'
import useMapLayout from '../flood/hooks/useMapLayout'
import './TsunamiModule.css'

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

const getCentroid = (points) => {
  if (!points.length) return TSUNAMI_DEFAULT_VIEW
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length
  const lon = points.reduce((sum, p) => sum + p.lon, 0) / points.length
  return { lat, lon }
}

/** pitch가 있을 때 destination만 쓰면 시선 중심이 밀림 — lookAt + range로 진원을 화면 중앙에 */
const flyToLookAt = (viewer, { lat, lon }, { range, pitchDeg, headingDeg = 0, duration = 2 }) => {
  if (!viewer || viewer.isDestroyed?.()) return

  const target = Cartesian3.fromDegrees(lon, lat, 0)
  viewer.camera.flyToBoundingSphere(new BoundingSphere(target, 50), {
    duration,
    offset: new HeadingPitchRange(
      CesiumMath.toRadians(headingDeg),
      CesiumMath.toRadians(pitchDeg),
      range
    ),
  })
}

/** 시작 시 진원 중심 조망 — 전파 링·연안 피해 확산을 함께 볼 수 있는 고도 */
const flyToEpicenterStart = (viewer, epicenter, impactPoints) => {
  const maxDistM = impactPoints.length > 0
    ? Math.max(...impactPoints.map((point) =>
      haversineDistanceM(epicenter.lat, epicenter.lon, point.lat, point.lon)
    ))
    : 120_000
  const range = Math.max(maxDistM * 3.1, 420_000)

  flyToLookAt(viewer, epicenter, { range, pitchDeg: -68, duration: 2.2 })
}

/** 진원·연안 참조 지점을 함께 담는 조망 카메라 (수동 '연안 조망' 버튼) */
const flyToOverview = (viewer, epicenter, impactPoints) => {
  if (!viewer || viewer.isDestroyed?.()) return

  const coast = getCentroid(impactPoints)
  const lookAt = {
    lat: (epicenter.lat + coast.lat) / 2,
    lon: (epicenter.lon + coast.lon) / 2,
  }
  const distM = haversineDistanceM(epicenter.lat, epicenter.lon, coast.lat, coast.lon)
  const range = Math.max(distM * 2.5, 380_000)

  flyToLookAt(viewer, lookAt, { range, pitchDeg: -70, duration: 2 })
}

/** 해안 쪽에서 밀려오는 파면을 클로즈업 (실제 쓰나미 영상 POV) */
const flyToCoastalWaveView = (viewer, epicenter, site) => {
  if (!viewer || viewer.isDestroyed?.()) return
  const cam = getCoastalWaveCamera(site, epicenter)
  flyToLookAt(viewer, cam, {
    range: cam.range,
    pitchDeg: cam.pitchDeg,
    headingDeg: cam.headingDeg,
    duration: 2.8,
  })
}

export default function TsunamiModule() {
  const viewerRef = useRef(null)
  const mapContainerRef = useRef(null)

  const [isViewerReady, setIsViewerReady] = useState(false)
  const [simState, setSimState] = useState('idle')
  const [epicenter, setEpicenter] = useState(DEFAULT_EPICENTER)
  const [impactSummary, setImpactSummary] = useState(null)
  const [tsunamiOptions, setTsunamiOptions] = useState(DEFAULT_TSUNAMI_OPTIONS)
  const [layerVisibility, setLayerVisibility] = useState(DEFAULT_LAYER_VISIBILITY)
  const [epochKey, setEpochKey] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [ringRadiusM, setRingRadiusM] = useState(0)
  const [seekMs, setSeekMs] = useState(null)
  const [isPickMode, setIsPickMode] = useState(false)

  const prevSimStateRef = useRef('idle')
  const prevPhaseRef = useRef('idle')
  const flewToCoastRef = useRef(false)

  const impactPoints = useMemo(
    () => getImpactPointsForEpicenter(epicenter),
    [epicenter]
  )

  const waveModel = useMemo(
    () => new TsunamiWaveModel({ epicenter, ...tsunamiOptions }),
    [epicenter, tsunamiOptions]
  )

  const firstArrivalMs = useMemo(() => {
    const arrivals = impactPoints
      .map((point) => waveModel.getArrivalMs(point.lat, point.lon))
      .filter(Number.isFinite)
    return arrivals.length > 0 ? Math.min(...arrivals) : null
  }, [waveModel, impactPoints])

  const totalMs = useMemo(() => waveModel.getTotalDurationMs(), [waveModel])

  const phase = useMemo(() => {
    if (simState === 'idle') return 'idle'
    if (simState === 'done') return 'done'
    const approaching = impactSummary?.impacts?.some(
      (item) => !item.reached && (item.approachProgress ?? 0) > 0.12
    )
    if (firstArrivalMs != null && elapsedMs < firstArrivalMs && !approaching) return 'traveling'
    if ((impactSummary?.affectedCount ?? 0) > 0 || approaching) return 'impacting'
    return 'traveling'
  }, [simState, elapsedMs, firstArrivalMs, impactSummary?.affectedCount, impactSummary?.impacts])

  useEffect(() => {
    if (simState !== 'running') return
    if (prevSimStateRef.current !== 'idle') return
    flewToCoastRef.current = false
    flyToEpicenterStart(viewerRef.current, epicenter, impactPoints)
  }, [simState, epicenter, impactPoints])

  useEffect(() => {
    if (simState !== 'running') return
    const viewer = viewerRef.current
    if (!viewer || flewToCoastRef.current || !impactSummary?.impacts?.length) return

    const approaching = impactSummary.impacts
      .filter((item) => !item.reached && (item.approachProgress ?? 0) >= 0.35)
      .sort((a, b) => (b.approachProgress ?? 0) - (a.approachProgress ?? 0))[0]

    if (!approaching) return

    flewToCoastRef.current = true
    flyToCoastalWaveView(viewer, epicenter, approaching)
  }, [simState, impactSummary, epicenter])

  useEffect(() => {
    prevSimStateRef.current = simState
  }, [simState])

  useEffect(() => {
    prevPhaseRef.current = phase
  }, [phase])

  const handleViewerReady = useCallback(() => {
    setIsViewerReady(true)
  }, [])

  const handleOptionsChange = useCallback((key, value) => {
    setTsunamiOptions((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleLayerVisibilityChange = useCallback((layerId, visible) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }))
  }, [])

  const handleFlyToOverview = useCallback(() => {
    flyToOverview(viewerRef.current, epicenter, impactPoints)
  }, [epicenter, impactPoints])

  const handleStart = useCallback(() => {
    setSeekMs(null)
    setSimState('running')
  }, [])

  const handlePause = useCallback(() => {
    setSimState('paused')
  }, [])

  const handleReset = useCallback(() => {
    flewToCoastRef.current = false
    setSimState('idle')
    setImpactSummary(null)
    setElapsedMs(0)
    setRingRadiusM(0)
    setSeekMs(null)
    setIsPickMode(false)
    setTsunamiOptions(DEFAULT_TSUNAMI_OPTIONS)
    setEpicenter(DEFAULT_EPICENTER)
    setEpochKey((key) => key + 1)
  }, [])

  const handleEpicenterChange = useCallback((nextEpicenter) => {
    setEpicenter(nextEpicenter)
    setIsPickMode(false)
  }, [])

  const handlePickEpicenter = useCallback(() => {
    setIsPickMode(true)
  }, [])

  const handleSimDone = useCallback(() => {
    setSimState('done')
  }, [])

  const handleImpactSummaryChange = useCallback((summary) => {
    setImpactSummary(summary)
  }, [])

  const handleStatsChange = useCallback(({ elapsedMs: nextElapsed, ringRadiusM: nextRadius }) => {
    setElapsedMs(nextElapsed)
    setRingRadiusM(nextRadius)
  }, [])

  const handleSeek = useCallback((ms) => {
    setSimState('paused')
    setSeekMs(ms)
    setElapsedMs(ms)
  }, [])

  useMapLayout(mapContainerRef, viewerRef, isViewerReady)

  return (
    <div className="tsunami-module">
      <TsunamiMainUI
        simState={simState}
        phase={phase}
        epicenter={epicenter}
        tsunamiOptions={tsunamiOptions}
        impactSummary={impactSummary}
        impactPoints={impactPoints}
        elapsedMs={elapsedMs}
        ringRadiusM={ringRadiusM}
        firstArrivalMs={firstArrivalMs}
        totalMs={totalMs}
        isPickMode={isPickMode}
        onEpicenterChange={handleEpicenterChange}
        onOptionsChange={handleOptionsChange}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onSeek={handleSeek}
        onPickEpicenter={handlePickEpicenter}
      />

      <div className="tsunami-module-stage">
        <div ref={mapContainerRef} className="tsunami-module-map">
          <CesiumMapViewer
            viewerRef={viewerRef}
            mapContainerRef={mapContainerRef}
            onViewerReady={handleViewerReady}
            initialLocation={TSUNAMI_DEFAULT_VIEW}
          />
          {isViewerReady && (
            <>
              <SimulationErrorBoundary
                key={epochKey}
                onRetry={() => setEpochKey((key) => key + 1)}
              >
                <SceneLayerController
                  viewerRef={viewerRef}
                  layerVisibility={layerVisibility}
                />
                <TsunamiVisualization
                  viewerRef={viewerRef}
                  simState={simState}
                  epicenter={epicenter}
                  tsunamiOptions={tsunamiOptions}
                  impactPoints={impactPoints}
                  seekMs={seekMs}
                  isPickMode={isPickMode}
                  onEpicenterChange={handleEpicenterChange}
                  onImpactSummaryChange={handleImpactSummaryChange}
                  onSimDone={handleSimDone}
                  onStatsChange={handleStatsChange}
                />
              </SimulationErrorBoundary>
              <MapStatusBar
                viewerRef={viewerRef}
                isActive={isViewerReady}
                waterLevel={impactSummary?.maxWaveHeightM ?? 0}
                levelLabel="최대 파고"
              />
            </>
          )}
        </div>
      </div>

      <SceneLayersPanel
        layerVisibility={layerVisibility}
        onLayerVisibilityChange={handleLayerVisibilityChange}
        onFlyToGangnam={handleFlyToOverview}
        flyToLabel="연안 조망"
      />
    </div>
  )
}
