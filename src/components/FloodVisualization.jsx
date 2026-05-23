import { useEffect, useRef } from 'react'
import {
  PolygonGeometry,
  Cartesian3,
  Color,
  PolygonOutlineGeometry,
  Primitive,
  PerInstanceColorAppearance,
} from 'cesium'

export default function FloodVisualization({ viewer, waterLevel }) {
  const floodPrimitiveRef = useRef(null)
  const outlinePrimitiveRef = useRef(null)

  useEffect(() => {
    if (!viewer || waterLevel === 0) {
      if (floodPrimitiveRef.current) {
        viewer.scene.primitives.remove(floodPrimitiveRef.current)
        floodPrimitiveRef.current = null
      }
      if (outlinePrimitiveRef.current) {
        viewer.scene.primitives.remove(outlinePrimitiveRef.current)
        outlinePrimitiveRef.current = null
      }
      return
    }

    if (floodPrimitiveRef.current) {
      viewer.scene.primitives.remove(floodPrimitiveRef.current)
    }
    if (outlinePrimitiveRef.current) {
      viewer.scene.primitives.remove(outlinePrimitiveRef.current)
    }

    const gangnamLat = 37.4975
    const gangnamLon = 127.0267

    const positions = [
      Cartesian3.fromDegrees(gangnamLon - 0.005, gangnamLat - 0.005, 0),
      Cartesian3.fromDegrees(gangnamLon + 0.005, gangnamLat - 0.005, 0),
      Cartesian3.fromDegrees(gangnamLon + 0.005, gangnamLat + 0.005, 0),
      Cartesian3.fromDegrees(gangnamLon - 0.005, gangnamLat + 0.005, 0),
    ]

    const polygonGeometry = new PolygonGeometry({
      polygonHierarchy: {
        positions: positions,
      },
      extrudedHeight: waterLevel,
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    })

    const outlineGeometry = new PolygonOutlineGeometry({
      polygonHierarchy: {
        positions: positions,
      },
      extrudedHeight: waterLevel,
    })

    const floodPrimitive = new Primitive({
      geometryInstances: {
        geometry: polygonGeometry,
        attributes: {
          color: PerInstanceColorAppearance.createColorAttribute(
            new Color(0.1, 0.5, 0.9, 0.6)
          ),
        },
      },
      appearance: new PerInstanceColorAppearance({
        translucent: true,
        flat: false,
      }),
    })

    const outlinePrimitive = new Primitive({
      geometryInstances: {
        geometry: outlineGeometry,
        attributes: {
          color: PerInstanceColorAppearance.createColorAttribute(
            new Color(0.0, 0.8, 1.0, 1.0)
          ),
        },
      },
      appearance: new PerInstanceColorAppearance({
        flat: false,
      }),
    })

    viewer.scene.primitives.add(floodPrimitive)
    viewer.scene.primitives.add(outlinePrimitive)

    floodPrimitiveRef.current = floodPrimitive
    outlinePrimitiveRef.current = outlinePrimitive

  }, [viewer, waterLevel])

  return null
}
