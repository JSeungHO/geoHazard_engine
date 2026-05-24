/**
 * earthquakeLiquefaction.js — 액상화 위험 휴리스틱 + overlay
 * 참조: earthquake-plan.md Phase 4
 *
 * 교육용: 연안·하천 저지대 + MMI VI+ + S파 도달 → 액상화 위험 표시
 */

import {
  ImageryLayer,
  Rectangle,
  SingleTileImageryProvider,
} from 'cesium'
import { haversineDistanceM } from '../../../physics/EarthquakeWaveModel'
import { computeMMIBounds } from './earthquakeMMILayer'

const LAYER_ID = 'eq-liquefaction-overlay'
const DEFAULT_SIZE = 192
const BUCKET_M = 50_000

/** 연안·하천 저지대 참조점 (교육용 proxy) */
export const LIQUEFACTION_PRONE_SITES = [
  { id: 'nakdong', label: '낙동강 하구', lat: 35.95, lon: 128.95 },
  { id: 'geum', label: '금강 하구', lat: 36.08, lon: 126.55 },
  { id: 'han', label: '한강 하구', lat: 37.45, lon: 126.58 },
  { id: 'yeongsan', label: '영산강 하구', lat: 34.82, lon: 126.42 },
  { id: 'pohang_coast', label: '포항 연안', lat: 36.02, lon: 129.38 },
  { id: 'ulsan_coast', label: '울산 연안', lat: 35.50, lon: 129.35 },
  { id: 'busan_coast', label: '부산 연안', lat: 35.10, lon: 129.05 },
  { id: 'incheon_coast', label: '인천 연안', lat: 37.42, lon: 126.55 },
]

const PRONE_RADIUS_M = 28_000
const MIN_MMI = 6

/** 연안·하천 저지대 여부 (Haversine) */
export function isLiquefactionProne(lat, lon) {
  return LIQUEFACTION_PRONE_SITES.some(
    (site) => haversineDistanceM(lat, lon, site.lat, site.lon) <= PRONE_RADIUS_M,
  )
}

export function getLiquefactionRefreshKey(sRadiusM, maxMMI) {
  return `${Math.floor(sRadiusM / BUCKET_M)}|${Math.round(maxMMI)}`
}

/**
 * @param {import('../../../physics/EarthquakeWaveModel').EarthquakeWaveModel} model
 * @param {number} elapsedMs
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 */
export function buildLiquefactionCanvas(model, elapsedMs, bounds, width = DEFAULT_SIZE, height = DEFAULT_SIZE) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  const lonSpan = bounds.east - bounds.west
  const latSpan = bounds.north - bounds.south

  for (let y = 0; y < height; y++) {
    const lat = bounds.north - (y / (height - 1)) * latSpan
    for (let x = 0; x < width; x++) {
      const lon = bounds.west + (x / (width - 1)) * lonSpan
      const idx = (y * width + x) * 4

      const sArrival = model.getSWaveArrivalMs(lat, lon)
      if (!Number.isFinite(sArrival) || elapsedMs < sArrival) {
        data[idx + 3] = 0
        continue
      }

      const mmi = model.getMMI(lat, lon)
      if (mmi < MIN_MMI || !isLiquefactionProne(lat, lon)) {
        data[idx + 3] = 0
        continue
      }

      const intensity = Math.min(1, (mmi - MIN_MMI) / 3)
      data[idx] = 180
      data[idx + 1] = 130
      data[idx + 2] = 40
      data[idx + 3] = Math.round(120 + intensity * 100)
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/** 액상화 위험 면적 추정 (km²) — canvas 픽셀 비율 근사 */
export function estimateLiquefactionAreaKm2(model, elapsedMs, bounds, sampleSize = 32) {
  if (typeof document === 'undefined') return 0

  const canvas = buildLiquefactionCanvas(model, elapsedMs, bounds, sampleSize, sampleSize)
  const ctx = canvas.getContext('2d')
  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize)

  let prone = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) prone++
  }

  const boundsWidthKm = haversineDistanceM(bounds.south, bounds.west, bounds.south, bounds.east) / 1000
  const boundsHeightKm = haversineDistanceM(bounds.south, bounds.west, bounds.north, bounds.west) / 1000
  const totalKm2 = boundsWidthKm * boundsHeightKm
  return (prone / (sampleSize * sampleSize)) * totalKm2
}

function findLayer(viewer) {
  const layers = viewer.imageryLayers
  for (let i = 0; i < layers.length; i++) {
    if (layers.get(i)?.eqLiquefactionOverlay) return layers.get(i)
  }
  return null
}

function removeLayer(viewer) {
  const layer = findLayer(viewer)
  if (layer) viewer.imageryLayers.remove(layer, true)
}

export function syncLiquefactionLayer(viewer, model, options = {}, cache = {}) {
  if (!viewer || viewer.isDestroyed?.()) return

  try {
    const {
      elapsedMs = 0,
      sRadiusM = 0,
      maxMMI = 0,
      epicenter,
      maxPropagationKm = 800,
    } = options

    if (!epicenter || elapsedMs <= 0 || sRadiusM <= 0 || maxMMI < MIN_MMI) {
      removeLayer(viewer)
      cache.current = null
      return
    }

    const key = getLiquefactionRefreshKey(sRadiusM, maxMMI)
    if (cache.current === key) return
    cache.current = key

    const bounds = computeMMIBounds(epicenter, maxPropagationKm)
    const canvas = buildLiquefactionCanvas(model, elapsedMs, bounds)
    const rectangle = Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north)

    removeLayer(viewer)

    const provider = new SingleTileImageryProvider({
      url: canvas.toDataURL('image/png'),
      rectangle,
      tileWidth: canvas.width,
      tileHeight: canvas.height,
    })

    const layer = viewer.imageryLayers.addImageryProvider(provider)
    layer.eqLiquefactionOverlay = true
    layer.alpha = 0.65
  } catch (err) {
    console.warn('[earthquakeLiquefaction] sync failed:', err)
    cache.current = null
  }
}

export function clearLiquefactionLayer(viewer, cache = {}) {
  if (!viewer || viewer.isDestroyed?.()) return
  removeLayer(viewer)
  cache.current = null
}
