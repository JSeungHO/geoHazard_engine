import { Color, GeoJsonDataSource } from 'cesium'
import {
  FLOOD_TRACE_DATASOURCE_NAME,
  FLOOD_TRACE_GEOJSON_URL,
} from '../constants/floodTraceData.js'

const TRACE_FILL = Color.fromBytes(208, 72, 56, 95)
const TRACE_STROKE = Color.fromBytes(168, 48, 32, 190)

/**
 * @param {import('cesium').Viewer} viewer
 * @returns {import('cesium').GeoJsonDataSource | undefined}
 */
export function findFloodTraceDataSource(viewer) {
  if (!viewer || viewer.isDestroyed?.()) return undefined

  for (let i = 0; i < viewer.dataSources.length; i += 1) {
    const ds = viewer.dataSources.get(i)
    if (ds.name === FLOOD_TRACE_DATASOURCE_NAME) return ds
  }
  return undefined
}

/**
 * @param {import('cesium').Viewer} viewer
 */
export function removeFloodTraceOverlay(viewer) {
  const existing = findFloodTraceDataSource(viewer)
  if (existing) viewer.dataSources.remove(existing, true)
}

/**
 * @param {import('cesium').Viewer} viewer
 * @returns {Promise<import('cesium').GeoJsonDataSource>}
 */
export async function loadFloodTraceOverlay(viewer) {
  if (!viewer || viewer.isDestroyed?.()) {
    throw new Error('Viewer is not available')
  }

  const existing = findFloodTraceDataSource(viewer)
  if (existing) return existing

  const dataSource = await GeoJsonDataSource.load(FLOOD_TRACE_GEOJSON_URL, {
    clampToGround: true,
    stroke: TRACE_STROKE,
    strokeWidth: 1,
    fill: TRACE_FILL,
  })

  dataSource.name = FLOOD_TRACE_DATASOURCE_NAME
  viewer.dataSources.add(dataSource)
  return dataSource
}
