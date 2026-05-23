import { useState, useRef } from 'react'
import { Viewer, CameraFlyTo } from 'resium'
import { Ion, Cartesian3, Math as CesiumMath } from 'cesium'
import RainControl from '../../components/RainControl'
import RainSystem from '../../components/RainSystem'
import WaterLevelControl from '../../components/WaterLevelControl'
import FloodVisualization from '../../components/FloodVisualization'
import './FloodModule.css'

window.CESIUM_BASE_URL = '/node_modules/cesium/Build/Cesium/'
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

export default function FloodModule() {
  const [rainIntensity, setRainIntensity] = useState(0)
  const [waterLevel, setWaterLevel] = useState(0)
  const viewerRef = useRef(null)
  const [viewer, setViewer] = useState(null)

  return (
    <div className="flood-module">
      <Viewer
        full
        ref={viewerRef}
        onViewerCesiumReady={() => {
          if (viewerRef.current?.cesiumElement) {
            setViewer(viewerRef.current.cesiumElement)
          }
        }}
      >
        <CameraFlyTo
          destination={Cartesian3.fromDegrees(127.0267, 37.4975, 500)}
          orientation={{
            heading: CesiumMath.toRadians(0),
            pitch: CesiumMath.toRadians(-60),
            roll: 0
          }}
          duration={0}
        />
      </Viewer>
      <RainControl intensity={rainIntensity} onIntensityChange={setRainIntensity} />
      <WaterLevelControl waterLevel={waterLevel} onWaterLevelChange={setWaterLevel} />
      {viewer && <RainSystem viewer={viewer} intensity={rainIntensity} />}
      {viewer && <FloodVisualization viewer={viewer} waterLevel={waterLevel} />}
    </div>
  )
}

