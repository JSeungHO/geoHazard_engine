/**
 * earthquakeMMILayer.js — MMI 진도 등진선 Cesium ImageryLayer overlay
 * 참조: earthquake-plan.md §9
 *
 * S파 도달 영역에만 MMI 색상을 표시한다.
 * 성능: affectedCount 또는 S파 반경 50 km 단위 변화 시에만 캔버스 재생성.
 */

import {
  ImageryLayer,
  Rectangle,
  SingleTileImageryProvider,
} from 'cesium'
import { MMI_COLORS } from '../../../physics/EarthquakeWaveModel'

const LAYER_ID = 'eq-mmi-overlay'
const DEFAULT_SIZE = 256
const S_RADIUS_BUCKET_M = 50_000

/** 진앙 기준 overlay bounds (degrees) */
export function computeMMIBounds(epicenter, maxPropagationKm) {
  const padDeg = (maxPropagationKm / 111) * 1.15
  return {
    west: epicenter.lon - padDeg * 1.3,
    east: epicenter.lon + padDeg * 1.3,
    south: epicenter.lat - padDeg,
    north: epicenter.lat + padDeg,
  }
}

/** 캔버스 갱신 키 — 동일 키면 재생성 생략 (S파 반경 bucket + 영향 도시 수) */
export function getMMIRefreshKey(affectedCount, sRadiusM) {
  const radiusBucket = Math.floor(sRadiusM / S_RADIUS_BUCKET_M)
  return `${affectedCount}|${radiusBucket}`
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** MMI → RGBA (alpha는 진도에 비례) */
export function mmiToRgba(mmi, alphaBase = 0.55) {
  const clamped = Math.round(Math.max(1, Math.min(12, mmi)))
  const hex = MMI_COLORS[clamped] ?? MMI_COLORS[12]
  const { r, g, b } = hexToRgb(hex)
  const alpha = Math.min(0.85, alphaBase * (0.35 + clamped / 14))
  return { r, g, b, a: Math.round(alpha * 255) }
}

/**
 * bounds 영역 MMI 캔버스 생성
 * @param {import('../../../physics/EarthquakeWaveModel').EarthquakeWaveModel} model
 * @param {number} elapsedMs
 * @param {number} [width]
 * @param {number} [height]
 * @param {{ west: number, south: number, east: number, north: number }} bounds
 */
export function buildMMICanvas(model, elapsedMs, bounds, width = DEFAULT_SIZE, height = DEFAULT_SIZE) {
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
      const { r, g, b, a } = mmiToRgba(mmi)
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function findMMILayer(viewer) {
  const layers = viewer.imageryLayers
  for (let i = 0; i < layers.length; i++) {
    const layer = layers.get(i)
    if (layer?.eqMmiOverlay) return layer
  }
  return null
}

function removeMMILayer(viewer) {
  const layer = findMMILayer(viewer)
  if (layer) viewer.imageryLayers.remove(layer, true)
}

/**
 * MMI overlay 동기화 — 변경 없으면 no-op
 * @param {import('cesium').Viewer} viewer
 * @param {import('../../../physics/EarthquakeWaveModel').EarthquakeWaveModel} model
 * @param {object} options
 * @param {number} options.elapsedMs
 * @param {number} [options.affectedCount=0]
 * @param {number} [options.sRadiusM=0]
 * @param {{ lat: number, lon: number }} options.epicenter
 * @param {number} [options.maxPropagationKm=800]
 * @param {{ current?: string }} [cache] — refresh key 캐시 (mutable ref object)
 */
export function syncMMILayer(viewer, model, options = {}, cache = {}) {
  if (!viewer || viewer.isDestroyed?.()) return

  try {
  const {
    elapsedMs = 0,
    affectedCount = 0,
    sRadiusM = 0,
    epicenter,
    maxPropagationKm = 800,
  } = options

  if (!epicenter || elapsedMs <= 0 || sRadiusM <= 0) {
    removeMMILayer(viewer)
    cache.current = null
    return
  }

  const refreshKey = getMMIRefreshKey(affectedCount, sRadiusM)
  if (cache.current === refreshKey) return
  cache.current = refreshKey

  const bounds = computeMMIBounds(epicenter, maxPropagationKm)
  const canvas = buildMMICanvas(model, elapsedMs, bounds)
  const rectangle = Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north)

  removeMMILayer(viewer)

  const provider = new SingleTileImageryProvider({
    url: canvas.toDataURL('image/png'),
    rectangle,
    tileWidth: canvas.width,
    tileHeight: canvas.height,
  })

  const layer = viewer.imageryLayers.addImageryProvider(provider)
  layer.eqMmiOverlay = true
  layer.alpha = 0.72
  } catch (err) {
    console.warn('[earthquakeMMILayer] sync failed:', err)
    cache.current = null
  }
}

/** overlay 제거 (unmount / reset) */
export function clearMMILayer(viewer, cache = {}) {
  if (!viewer || viewer.isDestroyed?.()) return
  removeMMILayer(viewer)
  cache.current = null
}
