import { useState, useRef, useCallback } from 'react'
import { Ion } from 'cesium'
import CesiumMapViewer from '../../components/CesiumMapViewer'
import FloodMainUI from '../../components/FloodMainUI'
import SceneLayersPanel from '../../components/SceneLayersPanel'
import SceneLayerController from '../../components/SceneLayerController'
import RainSystem from '../../components/RainSystem'
import FloodVisualization from '../../components/FloodVisualization'
import MapStatusBar from '../../components/MapStatusBar'
import { DEFAULT_SIMULATION_OPTIONS } from '../../constants/simulationDefaults'
import { DEFAULT_LAYER_VISIBILITY } from '../../constants/sceneLayers'
import useRainWaterAccumulation from './useRainWaterAccumulation'
import useMapLayout from './useMapLayout'
import { flyToGangnam } from '../../utils/flyToGangnam'
import './FloodModule.css'

window.CESIUM_BASE_URL = '/node_modules/cesium/Build/Cesium/'
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
              <SceneLayerController viewerRef={viewerRef} layerVisibility={layerVisibility} />
              <RainSystem viewerRef={viewerRef} intensity={rainIntensity} />
              <FloodVisualization
                viewerRef={viewerRef}
                waterLevel={waterLevel}
                rainIntensity={rainIntensity}
                simulationOptions={simulationOptions}
              />
              <MapStatusBar viewerRef={viewerRef} isActive={isViewerReady} />
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
