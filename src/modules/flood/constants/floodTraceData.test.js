import { describe, expect, it } from 'vitest'
import {
  FLOOD_TRACE_GEOJSON_URL,
  scenarioShowsFloodTrace,
} from '../constants/floodTraceData.js'

describe('floodTraceData', () => {
  it('gangnam_2022 scenario enables trace overlay', () => {
    expect(scenarioShowsFloodTrace('gangnam_2022')).toBe(true)
    expect(scenarioShowsFloodTrace('heavy_rain')).toBe(false)
    expect(scenarioShowsFloodTrace(null)).toBe(false)
  })

  it('serves GeoJSON from public path', () => {
    expect(FLOOD_TRACE_GEOJSON_URL).toBe('/data/seoul-flood-2022-gangnam.geojson')
  })
})
