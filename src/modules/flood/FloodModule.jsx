import { useState, useRef, useCallback } from 'react'
import { Ion } from 'cesium'
import CesiumMapViewer from '../../components/CesiumMapViewer'
import FloodMainUI from './components/FloodMainUI'
import SceneLayersPanel from '../../components/SceneLayersPanel'
import SceneLayerController from '../../components/SceneLayerController'
import RainSystem from './components/RainSystem'
import FloodVisualization from './components/FloodVisualization'
import FloodTraceOverlay from './components/FloodTraceOverlay'
import MapStatusBar from '../../components/MapStatusBar'
import SimulationErrorBoundary from '../../components/SimulationErrorBoundary'
import WelcomeOverlay from './components/WelcomeOverlay'
import TerrainLoadingBadge from './components/TerrainLoadingBadge'
import DrainageNetworkLayer from './drainage/DrainageNetworkLayer'
import DrainageLegend from './drainage/DrainageLegend'
import { DEFAULT_SIMULATION_OPTIONS } from './constants/simulationDefaults'
import { DEFAULT_LAYER_VISIBILITY } from '../../constants/sceneLayers'
import useRainWaterAccumulation from './hooks/useRainWaterAccumulation'
import useMapLayout from './hooks/useMapLayout'
import { flyToGangnam } from '../../locations/gangnam'
import { rainfallToVisualPercent } from './utils/displayUnits'
import { PONDING_DEFAULTS } from '../../physics/UrbanPondingModel'
import { DRAINAGE_DEFAULTS } from '../../physics/DrainageNetworkModel'
import { BUILDER_DEFAULTS } from '../../utils/drainageNetworkBuilder'

const DRAINAGE_PARAM_DEFAULTS = {
  inletClogging: DRAINAGE_DEFAULTS.inletClogging,
  designRainMmH: BUILDER_DEFAULTS.designRainMmH,
}
import './FloodModule.css'

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

export default function FloodModule() {
  /** @type {import('react').RefObject<import('cesium').Viewer | null>} */
  const viewerRef = useRef(null)
  /** @type {import('react').RefObject<HTMLDivElement | null>} */
  const mapContainerRef = useRef(null)

  const [isViewerReady, setIsViewerReady] = useState(false)
  const [rainfallMmH, setRainfallMmH] = useState(0)
  const [pondingParams, setPondingParams] = useState(PONDING_DEFAULTS)
  const [waterLevel, setWaterLevel] = useState(0)
  const [autoWaterRise, setAutoWaterRise] = useState(false)
  const [simulationOptions, setSimulationOptions] = useState(DEFAULT_SIMULATION_OPTIONS)
  const [layerVisibility, setLayerVisibility] = useState(DEFAULT_LAYER_VISIBILITY)
  const [isTerrainLoading, setIsTerrainLoading] = useState(false)
  const [simulationEpoch, setSimulationEpoch] = useState(0)
  const [activeScenarioId, setActiveScenarioId] = useState(null)
  const [drainageVisible, setDrainageVisible] = useState(true)
  const [drainageParams, setDrainageParams] = useState(DRAINAGE_PARAM_DEFAULTS)
  const [drainageStatus, setDrainageStatus] = useState(null)
  const [drainageSummary, setDrainageSummary] = useState(null)

  const handleViewerReady = useCallback(() => {
    setIsViewerReady(true)
  }, [])

  const handleOptionChange = useCallback((key, value) => {
    setSimulationOptions((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handlePondingParamChange = useCallback((key, value) => {
    setPondingParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleDrainageParamChange = useCallback((key, value) => {
    setDrainageParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleLayerVisibilityChange = useCallback((layerId, visible) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }))
  }, [])

  const handleFlyToGangnam = useCallback(() => {
    flyToGangnam(viewerRef.current)
  }, [])

  const handlePresetApply = useCallback((values) => {
    setSimulationOptions(values)
  }, [])

  const handleScenarioApply = useCallback((scenario) => {
    setActiveScenarioId(scenario.id)
    setRainfallMmH(scenario.rain)
    setWaterLevel(scenario.water)
    setAutoWaterRise(scenario.autoRise)
    if (scenario.id === 'gangnam_2022') {
      flyToGangnam(viewerRef.current)
    }
  }, [])

  const handleReset = useCallback(() => {
    setRainfallMmH(0)
    setPondingParams(PONDING_DEFAULTS)
    setDrainageParams(DRAINAGE_PARAM_DEFAULTS)
    setWaterLevel(0)
    setAutoWaterRise(false)
    setSimulationOptions(DEFAULT_SIMULATION_OPTIONS)
    setActiveScenarioId(null)
    setIsTerrainLoading(false)
    setSimulationEpoch((epoch) => epoch + 1)
  }, [])

  const handleTerrainLoadingChange = useCallback((loading) => {
    setIsTerrainLoading(loading)
  }, [])

  useRainWaterAccumulation(autoWaterRise, rainfallMmH, pondingParams, setWaterLevel)

  /** 강수 파티클·수면 파문 연출 강도 (0~100) */
  const rainVisualPercent = rainfallToVisualPercent(rainfallMmH)

  useMapLayout(mapContainerRef, viewerRef, isViewerReady)

  return (
    <div className="flood-module">
      <FloodMainUI
        rainfallMmH={rainfallMmH}
        onRainfallChange={setRainfallMmH}
        pondingParams={pondingParams}
        onPondingParamChange={handlePondingParamChange}
        autoWaterRise={autoWaterRise}
        onAutoWaterRiseChange={setAutoWaterRise}
        waterLevel={waterLevel}
        onWaterLevelChange={setWaterLevel}
        simulationOptions={simulationOptions}
        onOptionChange={handleOptionChange}
        onPresetApply={handlePresetApply}
        onScenarioApply={handleScenarioApply}
        activeScenarioId={activeScenarioId}
        onReset={handleReset}
        drainage={{
          visible: drainageVisible,
          onVisibleChange: setDrainageVisible,
          status: drainageStatus,
          summary: drainageSummary,
          params: drainageParams,
          onParamChange: handleDrainageParamChange,
        }}
      />

      <div className="flood-module-stage">
        <div ref={mapContainerRef} className="flood-module-map">
          <CesiumMapViewer
            viewerRef={viewerRef}
            mapContainerRef={mapContainerRef}
            onViewerReady={handleViewerReady}
          />
          {isViewerReady && (
            <>
              <WelcomeOverlay />
              <TerrainLoadingBadge visible={isTerrainLoading} />
              <SimulationErrorBoundary
                key={simulationEpoch}
                onRetry={() => setSimulationEpoch((epoch) => epoch + 1)}
              >
                <SceneLayerController
                  viewerRef={viewerRef}
                  layerVisibility={layerVisibility}
                />
                <RainSystem viewerRef={viewerRef} intensity={rainVisualPercent} />
                <FloodTraceOverlay
                  viewerRef={viewerRef}
                  activeScenarioId={activeScenarioId}
                />
                <DrainageNetworkLayer
                  viewerRef={viewerRef}
                  visible={drainageVisible}
                  rainfallMmH={rainfallMmH}
                  inletClogging={drainageParams.inletClogging}
                  designRainMmH={drainageParams.designRainMmH}
                  epoch={simulationEpoch}
                  onStatusChange={setDrainageStatus}
                  onSummaryChange={setDrainageSummary}
                />
                <FloodVisualization
                  viewerRef={viewerRef}
                  waterLevel={waterLevel}
                  rainIntensity={rainVisualPercent}
                  simulationOptions={simulationOptions}
                  onTerrainLoadingChange={handleTerrainLoadingChange}
                />
              </SimulationErrorBoundary>
              {drainageVisible && drainageStatus?.state === 'ready' && <DrainageLegend />}
              <SceneLayersPanel
                layerVisibility={layerVisibility}
                onLayerVisibilityChange={handleLayerVisibilityChange}
                onFlyTo={handleFlyToGangnam}
                flyToLabel="강남역 시점으로 이동"
              />
              <MapStatusBar
                viewerRef={viewerRef}
                isActive={isViewerReady}
                status={
                  waterLevel > 0
                    ? { label: '침수 깊이', value: `${Number(waterLevel).toFixed(2)} m`, tone: 'accent' }
                    : { label: '침수 없음' }
                }
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
