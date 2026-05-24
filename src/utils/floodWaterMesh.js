import {
  Cartesian3,
  ComponentDatatype,
  Ellipsoid,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  GeometryPipeline,
  MaterialAppearance,
  Primitive,
  PrimitiveType,
  BoundingSphere,
} from 'cesium'
import { lonLatFromUV } from './floodViewBounds'
import { getFloodWaterSurfaceHeight, getTerrainHeightAtCell } from './terrainHeight'
import { createFloodBodyMaterialFromShader } from './floodWaterMaterial'

export { FLOOD_HALF_SIZE_DEG } from './floodViewBounds'

/** @typedef {import('./floodViewBounds').FloodBounds} FloodBounds */
/** @typedef {import('./terrainHeight').TerrainHeightGrid} TerrainHeightGrid */
/**
 * UV(0~1) 기준 마스크 — 타원 또는 바다→육지 surge.
 * @typedef {{ centerU?: number, centerV?: number, radiusU?: number, radiusV?: number, feather?: number }} FloodEllipseMask
 * @typedef {{ type: 'surge', seaU: number, seaV: number, inlandU: number, inlandV: number, progress: number, crossRadius?: number, feather?: number }} FloodSurgeMask
 */

const pushTriangle = (indices, a, b, c) => {
  indices.push(a, b, c)
}

const surgeMaskWeight = (u, v, mask) => {
  const axisU = mask.inlandU - mask.seaU
  const axisV = mask.inlandV - mask.seaV
  const axisLen = Math.hypot(axisU, axisV) || 1
  const axisNormU = axisU / axisLen
  const axisNormV = axisV / axisLen

  const relU = u - mask.seaU
  const relV = v - mask.seaV
  const along = relU * axisNormU + relV * axisNormV
  const perp = Math.abs(relU * (-axisNormV) + relV * axisNormU)

  const front = axisLen * (mask.progress ?? 1)
  const crossR = mask.crossRadius ?? 0.4
  const feather = mask.feather ?? 0.06

  if (perp > crossR + feather * 0.5 || along < -feather) return 0
  if (along > front + feather) return 0

  let weight = 1
  if (along > front - feather) weight = Math.min(weight, (front + feather - along) / (2 * feather))
  if (along < feather) weight = Math.min(weight, (along + feather) / (2 * feather))
  if (perp > crossR - feather) weight = Math.min(weight, (crossR + feather - perp) / (2 * feather))

  return Math.max(0, weight)
}

/** @param {number} u @param {number} v @param {FloodEllipseMask | FloodSurgeMask | null | undefined} mask */
export function floodMaskWeight(u, v, mask) {
  if (!mask) return 1
  if (mask.type === 'surge') return surgeMaskWeight(u, v, mask)

  const centerU = mask.centerU ?? 0.5
  const centerV = mask.centerV ?? 0.5
  const radiusU = mask.radiusU ?? 0.5
  const radiusV = mask.radiusV ?? 0.5
  const du = (u - centerU) / radiusU
  const dv = (v - centerV) / radiusV
  const dist = Math.sqrt(du * du + dv * dv)
  const feather = mask.feather ?? 0.06

  if (dist <= 1 - feather) return 1
  if (dist >= 1 + feather) return 0
  return (1 + feather - dist) / (2 * feather)
}

/** @param {FloodEllipseMask | null | undefined} mask */
const cellTouchesFloodMask = (u0, u1, v0, v1, mask) => {
  if (!mask) return true
  if (floodMaskWeight((u0 + u1) / 2, (v0 + v1) / 2, mask) > 0) return true
  return (
    floodMaskWeight(u0, v0, mask) > 0
    || floodMaskWeight(u1, v0, mask) > 0
    || floodMaskWeight(u0, v1, mask) > 0
    || floodMaskWeight(u1, v1, mask) > 0
  )
}

const cartesianFromLonLatHeight = (lon, lat, height, target) =>
  Cartesian3.fromDegrees(lon, lat, height, undefined, target)

const buildFloodedSurfaceIndices = (res, terrainGrid, waterSurfaceHeight, floodMask = null) => {
  const indices = []
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const u0 = i / (res - 1)
      const u1 = (i + 1) / (res - 1)
      const v0 = j / (res - 1)
      const v1 = (j + 1) / (res - 1)
      if (!cellTouchesFloodMask(u0, u1, v0, v1, floodMask)) continue

      const hLL = getTerrainHeightAtCell(terrainGrid, res, i, j, Infinity)
      const hLR = getTerrainHeightAtCell(terrainGrid, res, i + 1, j, Infinity)
      const hUL = getTerrainHeightAtCell(terrainGrid, res, i, j + 1, Infinity)
      const hUR = getTerrainHeightAtCell(terrainGrid, res, i + 1, j + 1, Infinity)
      if (Math.min(hLL, hLR, hUL, hUR) >= waterSurfaceHeight) continue

      const a = j * res + i
      const b = a + 1
      const c = a + res
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  return new Uint32Array(indices)
}

/** 저지대 기준 수면 캐시 — 수면은 평면, 파동은 법선 방향 오프셋 */
export function createWaterSurfaceCache(bounds, terrainGrid, floodDepthMeters, resolution, options = {}) {
  const { floodMask = null } = options
  const res = resolution
  const waterSurfaceHeight = getFloodWaterSurfaceHeight(terrainGrid, floodDepthMeters)
  const vertexCount = res * res
  const basePositions = new Float64Array(vertexCount * 3)
  const normals = new Float64Array(vertexCount * 3)
  const sts = new Float32Array(vertexCount * 2)
  const scratch = new Cartesian3()
  const normalScratch = new Cartesian3()

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const u = i / (res - 1)
      const v = j / (res - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      const cartesian = cartesianFromLonLatHeight(lon, lat, waterSurfaceHeight, scratch)
      const normal = Ellipsoid.WGS84.geodeticSurfaceNormal(cartesian, normalScratch)

      const pi = (j * res + i) * 3
      basePositions[pi] = cartesian.x
      basePositions[pi + 1] = cartesian.y
      basePositions[pi + 2] = cartesian.z
      normals[pi] = normal.x
      normals[pi + 1] = normal.y
      normals[pi + 2] = normal.z

      const si = (j * res + i) * 2
      sts[si] = u
      sts[si + 1] = v
    }
  }

  const indices = buildFloodedSurfaceIndices(res, terrainGrid, waterSurfaceHeight, floodMask)

  return {
    res,
    waterSurfaceHeight,
    basePositions,
    normals,
    sts,
    indices,
    boundingSphere: BoundingSphere.fromVertices(basePositions),
  }
}

export function buildWaterSurfacePositionsFromCache(cache, waveEngine, target) {
  const positions = target ?? new Float64Array(cache.basePositions.length)
  const res = cache.res
  const waves = waveEngine.heights

  for (let k = 0; k < res * res; k++) {
    const wave = waves[k]
    const pi = k * 3
    positions[pi] = cache.basePositions[pi] + cache.normals[pi] * wave
    positions[pi + 1] = cache.basePositions[pi + 1] + cache.normals[pi + 1] * wave
    positions[pi + 2] = cache.basePositions[pi + 2] + cache.normals[pi + 2] * wave
  }

  return positions
}

export function buildWaterSurfaceGeometryFromCache(cache, waveEngine, positionBuffer) {
  if (cache.indices.length === 0) return null

  const positions = buildWaterSurfacePositionsFromCache(cache, waveEngine, positionBuffer)

  return new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      normal: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 3,
        values: cache.normals,
      }),
      st: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: cache.sts,
      }),
    },
    indices: cache.indices,
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: cache.boundingSphere,
  })
}

/** 물리 시뮬레이션 결과로 수면 Geometry (저지대 기준 평면 수면 + 파동) */
export function buildWaterSurfaceGeometry(waveEngine, floodDepthMeters, bounds, terrainGrid, floodMask = null) {
  const res = waveEngine.resolution
  const waterSurfaceHeight = getFloodWaterSurfaceHeight(terrainGrid, floodDepthMeters)
  const vertexCount = res * res
  const positions = new Float64Array(vertexCount * 3)
  const sts = new Float32Array(vertexCount * 2)
  const scratch = new Cartesian3()

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const u = i / (res - 1)
      const v = j / (res - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      const wave = waveEngine.heights[j * res + i]
      const cartesian = cartesianFromLonLatHeight(lon, lat, waterSurfaceHeight + wave, scratch)

      const pi = (j * res + i) * 3
      positions[pi] = cartesian.x
      positions[pi + 1] = cartesian.y
      positions[pi + 2] = cartesian.z

      const si = (j * res + i) * 2
      sts[si] = u
      sts[si + 1] = v
    }
  }

  const indices = buildFloodedSurfaceIndices(res, terrainGrid, waterSurfaceHeight, floodMask)
  if (indices.length === 0) return null

  let geometry = new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      st: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: sts,
      }),
    },
    indices: new Uint32Array(indices),
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(positions),
  })

  return GeometryPipeline.computeNormal(geometry)
}

export function createWaterSurfacePrimitive(waveEngine, floodDepthMeters, material, bounds, terrainGrid) {
  const geometry = buildWaterSurfaceGeometry(waveEngine, floodDepthMeters, bounds, terrainGrid)
  if (!geometry) return null

  return new Primitive({
    geometryInstances: new GeometryInstance({ geometry }),
    appearance: new MaterialAppearance({
      material,
      translucent: true,
      closed: false,
      faceForward: true,
    }),
    asynchronous: false,
  })
}

export function createWaterSurfacePrimitiveFromCache(cache, waveEngine, material, positionBuffer) {
  const geometry = buildWaterSurfaceGeometryFromCache(cache, waveEngine, positionBuffer)
  if (!geometry) return null

  return new Primitive({
    geometryInstances: new GeometryInstance({ geometry }),
    appearance: new MaterialAppearance({
      material,
      translucent: true,
      closed: false,
      faceForward: true,
    }),
    asynchronous: false,
  })
}

/** @param {TerrainHeightGrid} fullGrid @returns {TerrainHeightGrid} */
export function downsampleTerrainGrid(fullGrid, targetRes) {
  const srcRes = fullGrid.resolution
  if (srcRes === targetRes) return fullGrid

  const heights = new Float32Array(targetRes * targetRes)

  for (let j = 0; j < targetRes; j++) {
    for (let i = 0; i < targetRes; i++) {
      const u = i / (targetRes - 1)
      const v = j / (targetRes - 1)
      const si = Math.min(srcRes - 1, Math.round(u * (srcRes - 1)))
      const sj = Math.min(srcRes - 1, Math.round(v * (srcRes - 1)))
      heights[j * targetRes + i] = fullGrid.heights[sj * srcRes + si]
    }
  }

  let minHeight = Infinity
  let maxHeight = -Infinity
  let validCount = 0
  for (let k = 0; k < heights.length; k++) {
    const h = heights[k]
    if (!Number.isFinite(h)) continue
    validCount += 1
    minHeight = Math.min(minHeight, h)
    maxHeight = Math.max(maxHeight, h)
  }

  return {
    heights,
    resolution: targetRes,
    minHeight: validCount > 0 ? minHeight : NaN,
    maxHeight: validCount > 0 ? maxHeight : NaN,
    validCount,
  }
}

const BODY_GRID_RES = 28
const MAX_BODY_CELLS = BODY_GRID_RES * BODY_GRID_RES
const MAX_BODY_VERTS = MAX_BODY_CELLS * 8
const MAX_BODY_TRIS = MAX_BODY_CELLS * 10
const _bodyPositions = new Float64Array(MAX_BODY_VERTS * 3)
const _bodyIndices = new Uint32Array(MAX_BODY_TRIS * 3)

const writeBodyTriangle = (indices, cursor, a, b, c) => {
  indices[cursor] = a
  indices[cursor + 1] = b
  indices[cursor + 2] = c
  return cursor + 3
}

/** 지형 그리드 기준 침수 수체 (저지대→수면 높이, 침수 구역만) */
export function buildFloodBodyGeometry(bounds, terrainGrid, floodDepth, options = {}) {
  const { omitTopCap = false, floodMask = null } = options
  if (!terrainGrid?.heights || floodDepth <= 0) return null

  const waterSurfaceHeight = getFloodWaterSurfaceHeight(terrainGrid, floodDepth)

  const bodyGrid =
    terrainGrid.resolution === BODY_GRID_RES
      ? terrainGrid
      : downsampleTerrainGrid(terrainGrid, BODY_GRID_RES)

  const bodyRes = bodyGrid.resolution
  let vertCursor = 0
  let idxCursor = 0
  const vertexScratch = new Cartesian3()

  const heightAt = (i, j) => getTerrainHeightAtCell(bodyGrid, bodyRes, i, j, Infinity)

  const pushVertex = (lon, lat, height) => {
    if (vertCursor >= MAX_BODY_VERTS) return -1
    const c = cartesianFromLonLatHeight(lon, lat, height, vertexScratch)
    const pi = vertCursor * 3
    _bodyPositions[pi] = c.x
    _bodyPositions[pi + 1] = c.y
    _bodyPositions[pi + 2] = c.z
    return vertCursor++
  }

  const pushTriangle = (a, b, c) => {
    if (a < 0 || b < 0 || c < 0 || idxCursor + 3 > _bodyIndices.length) return
    idxCursor = writeBodyTriangle(_bodyIndices, idxCursor, a, b, c)
  }

  for (let j = 0; j < bodyRes - 1; j++) {
    for (let i = 0; i < bodyRes - 1; i++) {
      const u0 = i / (bodyRes - 1)
      const u1 = (i + 1) / (bodyRes - 1)
      const v0 = j / (bodyRes - 1)
      const v1 = (j + 1) / (bodyRes - 1)

      if (!cellTouchesFloodMask(u0, u1, v0, v1, floodMask)) continue

      const ll = lonLatFromUV(bounds, u0, v0)
      const lr = lonLatFromUV(bounds, u1, v0)
      const ul = lonLatFromUV(bounds, u0, v1)
      const ur = lonLatFromUV(bounds, u1, v1)

      const hLL = heightAt(i, j)
      const hLR = heightAt(i + 1, j)
      const hUL = heightAt(i, j + 1)
      const hUR = heightAt(i + 1, j + 1)

      if (Math.min(hLL, hLR, hUL, hUR) >= waterSurfaceHeight) continue
      if (vertCursor + 8 > MAX_BODY_VERTS || idxCursor + 30 > _bodyIndices.length) break

      const bLL = pushVertex(ll.lon, ll.lat, hLL)
      const bLR = pushVertex(lr.lon, lr.lat, hLR)
      const bUL = pushVertex(ul.lon, ul.lat, hUL)
      const bUR = pushVertex(ur.lon, ur.lat, hUR)

      const tLL = pushVertex(ll.lon, ll.lat, waterSurfaceHeight)
      const tLR = pushVertex(lr.lon, lr.lat, waterSurfaceHeight)
      const tUL = pushVertex(ul.lon, ul.lat, waterSurfaceHeight)
      const tUR = pushVertex(ur.lon, ur.lat, waterSurfaceHeight)

      pushTriangle(bLL, bLR, bUL)
      pushTriangle(bLR, bUR, bUL)

      if (!omitTopCap) {
        pushTriangle(tLL, tUL, tLR)
        pushTriangle(tLR, tUL, tUR)
      }

      pushTriangle(bLL, tLL, bLR)
      pushTriangle(bLR, tLL, tLR)

      pushTriangle(bLR, tLR, bUR)
      pushTriangle(bUR, tLR, tUR)

      pushTriangle(bUL, bUR, tUL)
      pushTriangle(bUR, tUR, tUL)

      pushTriangle(bLL, bUL, tLL)
      pushTriangle(bUL, tUL, tLL)
    }
  }

  if (idxCursor === 0) return null

  const positionArray = _bodyPositions.subarray(0, vertCursor * 3).slice()
  const indexArray = _bodyIndices.subarray(0, idxCursor).slice()

  let geometry = new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positionArray,
      }),
    },
    indices: indexArray,
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(positionArray),
  })

  try {
    return GeometryPipeline.computeNormal(geometry)
  } catch {
    return null
  }
}

export function createFloodBodyPrimitive(floodDepth, material, bounds, terrainGrid, options = {}) {
  const { omitTopCap = true, floodMask = null } = options
  const geometry = buildFloodBodyGeometry(bounds, terrainGrid, floodDepth, { omitTopCap, floodMask })
  if (!geometry) return null

  return new Primitive({
    geometryInstances: new GeometryInstance({ geometry }),
    appearance: new MaterialAppearance({
      material,
      translucent: true,
      closed: true,
      faceForward: true,
    }),
    asynchronous: false,
  })
}

export function createFloodBodyMaterial() {
  return createFloodBodyMaterialFromShader()
}
