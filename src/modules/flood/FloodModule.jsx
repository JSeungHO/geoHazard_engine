import { Viewer, CameraFlyTo } from 'resium'
import { Ion, Cartesian3, Math as CesiumMath } from 'cesium'
import './FloodModule.css'

window.CESIUM_BASE_URL = '/node_modules/cesium/Build/Cesium/'
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

export default function FloodModule() {
  return (
    <div className="flood-module">
      <Viewer full>
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
    </div>
  )
}

