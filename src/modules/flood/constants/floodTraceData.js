/** GeoJSON served from /public for Vercel deploy */
export const FLOOD_TRACE_GEOJSON_URL = '/data/seoul-flood-2022-gangnam.geojson'

export const FLOOD_TRACE_DATASOURCE_NAME = 'seoul-flood-2022-gangnam'

/** @param {string | null | undefined} scenarioId */
export function scenarioShowsFloodTrace(scenarioId) {
  return scenarioId === 'gangnam_2022'
}
