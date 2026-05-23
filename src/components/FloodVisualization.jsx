import { useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  CallbackProperty,
  HeightReference,
  JulianDate,
  PolygonHierarchy,
} from 'cesium'
import { GANGNAM_LAT, GANGNAM_LON } from '../constants/gangnam'
import { FloodWaterMaterialProperty } from '../utils/floodWaterMaterial'

const FLOOD_ENTITY_ID = 'gangnam-flood-zone'
const FLOOD_HALF_SIZE_DEG = 0.005

const createFloodHierarchy = () =>
  new PolygonHierarchy(
    Cartesian3.fromDegreesArray([
      GANGNAM_LON - FLOOD_HALF_SIZE_DEG,
      GANGNAM_LAT - FLOOD_HALF_SIZE_DEG,
      GANGNAM_LON + FLOOD_HALF_SIZE_DEG,
      GANGNAM_LAT - FLOOD_HALF_SIZE_DEG,
      GANGNAM_LON + FLOOD_HALF_SIZE_DEG,
      GANGNAM_LAT + FLOOD_HALF_SIZE_DEG,
      GANGNAM_LON - FLOOD_HALF_SIZE_DEG,
      GANGNAM_LAT + FLOOD_HALF_SIZE_DEG,
    ])
  )

const createAnimatedOutlineColor = () =>
  new CallbackProperty((time) => {
    const seconds = JulianDate.toDate(time ?? JulianDate.now()).getTime() / 1000
    const pulse = 0.6 + 0.3 * Math.sin(seconds * 3.2)
    return Color.CYAN.withAlpha(pulse)
  }, false)

const getViewer = (viewerRef) => {
  const viewer = viewerRef.current
  if (!viewer || viewer.isDestroyed?.()) return null
  return viewer
}

/** viewerRef.current의 entity만 갱신 (뷰어·카메라 재마운트 없음) */
export default function FloodVisualization({ viewerRef, waterLevel }) {
  const entityRef = useRef(null)
  const waterMaterialRef = useRef(null)

  useEffect(() => {
    const viewer = getViewer(viewerRef)
    if (!viewer) return

    if (!waterMaterialRef.current) {
      waterMaterialRef.current = new FloodWaterMaterialProperty()
    }

    let entity = viewer.entities.getById(FLOOD_ENTITY_ID)
    if (!entity) {
      entity = viewer.entities.add({
        id: FLOOD_ENTITY_ID,
        show: false,
        polygon: {
          hierarchy: createFloodHierarchy(),
          height: 0,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          extrudedHeight: 1,
          extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND,
          material: waterMaterialRef.current,
          outline: true,
          outlineColor: createAnimatedOutlineColor(),
          outlineWidth: 2,
        },
      })
    } else {
      entity.polygon.material = waterMaterialRef.current
    }

    entityRef.current = entity

    return () => {
      if (!viewer.isDestroyed?.()) {
        const existing = viewer.entities.getById(FLOOD_ENTITY_ID)
        if (existing) {
          viewer.entities.remove(existing)
        }
      }
      entityRef.current = null
      waterMaterialRef.current = null
    }
  }, [viewerRef])

  useEffect(() => {
    const entity = entityRef.current
    if (!entity) return

    if (waterLevel <= 0) {
      entity.show = false
      return
    }

    entity.show = true
    entity.polygon.extrudedHeight = waterLevel
  }, [waterLevel])

  return null
}
