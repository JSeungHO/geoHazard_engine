import { useState, useRef, useCallback } from 'react'
import { Ion } from 'cesium'
import CesiumMapViewer from '../../components/CesiumMapViewer'
import RainControl from '../../components/RainControl'
import RainSystem from '../../components/RainSystem'
import WaterLevelControl from '../../components/WaterLevelControl'
import FloodVisualization from '../../components/FloodVisualization'
import './FloodModule.css'

window.CESIUM_BASE_URL = '/node_modules/cesium/Build/Cesium/'
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

export default function FloodModule() {
  /** @type {import('react').RefObject<import('cesium').Viewer | null>} */
  const viewerRef = useRef(null)

  const [isViewerReady, setIsViewerReady] = useState(false)
  const [rainIntensity, setRainIntensity] = useState(0)
  const [waterLevel, setWaterLevel] = useState(0)

  const handleViewerReady = useCallback(() => {
    setIsViewerReady(true)
  }, [])

  return (
    <div className="flood-module">
      <CesiumMapViewer viewerRef={viewerRef} onViewerReady={handleViewerReady} />
      <RainControl intensity={rainIntensity} onIntensityChange={setRainIntensity} />
      <WaterLevelControl waterLevel={waterLevel} onWaterLevelChange={setWaterLevel} />
      {isViewerReady && (
        <>
          <RainSystem viewerRef={viewerRef} intensity={rainIntensity} />
          <FloodVisualization viewerRef={viewerRef} waterLevel={waterLevel} />
        </>
      )}
    </div>
  )
}
