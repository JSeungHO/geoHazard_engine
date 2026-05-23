import { useState, useRef, useCallback } from 'react'
import { Ion } from 'cesium'
import CesiumMapViewer from '../../components/CesiumMapViewer'
import FloodMainUI from './components/FloodMainUI'
import SceneLayersPanel from '../../components/SceneLayersPanel'
import SceneLayerController from '../../components/SceneLayerController'
import RainSystem from './components/RainSystem'
import FloodVisualization from './components/FloodVisualization'
import MapStatusBar from '../../components/MapStatusBar'
import SimulationErrorBoundary from '../../components/SimulationErrorBoundary'
import WelcomeOverlay from './components/WelcomeOverlay'
import TerrainLoadingBadge from './components/TerrainLoadingBadge'
import { DEFAULT_SIMULATION_OPTIONS } from './constants/simulationDefaults'
import { DEFAULT_LAYER_VISIBILITY } from '../../constants/sceneLayers'
import useRainWaterAccumulation from './hooks/useRainWaterAccumulation'
import useMapLayout from './hooks/useMapLayout'
import { flyToGangnam } from '../../locations/gangnam'
import './FloodModule.css'

Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

export default function FloodModule() {
  /** @type {import('react').RefObject<import('cesium').Viewer | null>} */
  const viewerRef = useRef(null)
  /** @type {import('react').RefObject<HTMLDivElement | null>} */
  const mapContainerRef = useRef(null)

  const [isViewerReady, setIsViewerReady] = useState(false)
  const [rainIntensity, setRainIntensity] = useState(0)
  const [waterLevel, setWaterLevel] = useState(0)
  const [autoWaterRise, setAutoWaterRise] = useState(false)
  const [simulationOptions, setSimulationOptions] = useState(DEFAULT_SIMULATION_OPTIONS)
  const [layerVisibility, setLayerVisibility] = useState(DEFAULT_LAYER_VISIBILITY)
  const [isTerrainLoading, setIsTerrainLoading] = useState(false)
  const [simulationEpoch, setSimulationEpoch] = useState(0)

  const handleViewerReady = useCallback(() => {
    setIsViewerReady(true)
  }, [])

  const handleOptionChange = useCallback((key, value) => {
    setSimulationOptions((prev) => ({ ...prev, [key]: value }))
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
    setRainIntensity(scenario.rain)
    setWaterLevel(scenario.water)
    setAutoWaterRise(scenario.autoRise)
  }, [])

  const handleReset = useCallback(() => {
    setRainIntensity(0)
    setWaterLevel(0)
    setAutoWaterRise(false)
    setSimulationOptions(DEFAULT_SIMULATION_OPTIONS)
    setIsTerrainLoading(false)
    setSimulationEpoch((epoch) => epoch + 1)
  }, [])

  const handleTerrainLoadingChange = useCallback((loading) => {
    setIsTerrainLoading(loading)
  }, [])

  useRainWaterAccumulation(
    autoWaterRise,
    rainIntensity,
    simulationOptions.waterRiseSpeed,
    setWaterLevel
  )

  useMapLayout(mapContainerRef, viewerRef, isViewerReady)

  return (
    <div className="flood-module">
      <FloodMainUI
        rainIntensity={rainIntensity}
        onRainIntensityChange={setRainIntensity}
        autoWaterRise={autoWaterRise}
        onAutoWaterRiseChange={setAutoWaterRise}
        waterLevel={waterLevel}
        onWaterLevelChange={setWaterLevel}
        simulationOptions={simulationOptions}
        onOptionChange={handleOptionChange}
        onPresetApply={handlePresetApply}
        onScenarioApply={handleScenarioApply}
        onReset={handleReset}
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
                <RainSystem viewerRef={viewerRef} intensity={rainIntensity} />
                <FloodVisualization
                  viewerRef={viewerRef}
                  waterLevel={waterLevel}
                  rainIntensity={rainIntensity}
                  simulationOptions={simulationOptions}
                  onTerrainLoadingChange={handleTerrainLoadingChange}
                />
              </SimulationErrorBoundary>
              <MapStatusBar
                viewerRef={viewerRef}
                isActive={isViewerReady}
                waterLevel={waterLevel}
              />
            </>
          )}
        </div>
      </div>

      <SceneLayersPanel
        layerVisibility={layerVisibility}
        onLayerVisibilityChange={handleLayerVisibilityChange}
        onFlyToGangnam={handleFlyToGangnam}
      />
    </div>
  )
}
