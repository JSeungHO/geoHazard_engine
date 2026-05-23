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

const pushTriangle = (indices, a, b, c) => {
  indices.push(a, b, c)
}

const cartesianFromLonLatHeight = (lon, lat, height, target) =>
  Cartesian3.fromDegrees(lon, lat, height, undefined, target)

const buildFloodedSurfaceIndices = (res, terrainGrid, waterSurfaceHeight) => {
  const indices = []
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
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
export function createWaterSurfaceCache(bounds, terrainGrid, floodDepthMeters, resolution) {
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

  const indices = buildFloodedSurfaceIndices(res, terrainGrid, waterSurfaceHeight)

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

export function buildWaterSurfaceGeometryFromCache(cache, waveEngine) {
  if (cache.indices.length === 0) return null

  const positions = buildWaterSurfacePositionsFromCache(cache, waveEngine)

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
export function buildWaterSurfaceGeometry(waveEngine, floodDepthMeters, bounds, terrainGrid) {
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

  const indices = buildFloodedSurfaceIndices(res, terrainGrid, waterSurfaceHeight)
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

export function createWaterSurfacePrimitiveFromCache(cache, waveEngine, material) {
  const geometry = buildWaterSurfaceGeometryFromCache(cache, waveEngine)
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

/** 지형 그리드 기준 침수 수체 (저지대→수면 높이, 침수 구역만) */
export function buildFloodBodyGeometry(bounds, terrainGrid, floodDepth) {
  if (!terrainGrid?.heights || floodDepth <= 0) return null

  const waterSurfaceHeight = getFloodWaterSurfaceHeight(terrainGrid, floodDepth)

  const bodyGrid =
    terrainGrid.resolution === BODY_GRID_RES
      ? terrainGrid
      : downsampleTerrainGrid(terrainGrid, BODY_GRID_RES)

  const bodyRes = bodyGrid.resolution
  const positions = []
  const indices = []
  const vertexScratch = new Cartesian3()

  const heightAt = (i, j) => getTerrainHeightAtCell(bodyGrid, bodyRes, i, j, Infinity)

  const pushVertex = (lon, lat, height) => {
    const c = cartesianFromLonLatHeight(lon, lat, height, vertexScratch)
    positions.push(c.x, c.y, c.z)
    return positions.length / 3 - 1
  }

  for (let j = 0; j < bodyRes - 1; j++) {
    for (let i = 0; i < bodyRes - 1; i++) {
      const u0 = i / (bodyRes - 1)
      const u1 = (i + 1) / (bodyRes - 1)
      const v0 = j / (bodyRes - 1)
      const v1 = (j + 1) / (bodyRes - 1)

      const ll = lonLatFromUV(bounds, u0, v0)
      const lr = lonLatFromUV(bounds, u1, v0)
      const ul = lonLatFromUV(bounds, u0, v1)
      const ur = lonLatFromUV(bounds, u1, v1)

      const hLL = heightAt(i, j)
      const hLR = heightAt(i + 1, j)
      const hUL = heightAt(i, j + 1)
      const hUR = heightAt(i + 1, j + 1)

      if (Math.min(hLL, hLR, hUL, hUR) >= waterSurfaceHeight) continue

      const bLL = pushVertex(ll.lon, ll.lat, hLL)
      const bLR = pushVertex(lr.lon, lr.lat, hLR)
      const bUL = pushVertex(ul.lon, ul.lat, hUL)
      const bUR = pushVertex(ur.lon, ur.lat, hUR)

      const tLL = pushVertex(ll.lon, ll.lat, waterSurfaceHeight)
      const tLR = pushVertex(lr.lon, lr.lat, waterSurfaceHeight)
      const tUL = pushVertex(ul.lon, ul.lat, waterSurfaceHeight)
      const tUR = pushVertex(ur.lon, ur.lat, waterSurfaceHeight)

      pushTriangle(indices, bLL, bLR, bUL)
      pushTriangle(indices, bLR, bUR, bUL)

      pushTriangle(indices, tLL, tUL, tLR)
      pushTriangle(indices, tLR, tUL, tUR)

      pushTriangle(indices, bLL, tLL, bLR)
      pushTriangle(indices, bLR, tLL, tLR)

      pushTriangle(indices, bLR, tLR, bUR)
      pushTriangle(indices, bUR, tLR, tUR)

      pushTriangle(indices, bUL, bUR, tUL)
      pushTriangle(indices, bUR, tUR, tUL)

      pushTriangle(indices, bLL, bUL, tLL)
      pushTriangle(indices, bUL, tUL, tLL)
    }
  }

  if (indices.length === 0) return null

  const positionArray = new Float64Array(positions)

  let geometry = new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positionArray,
      }),
    },
    indices: new Uint32Array(indices),
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere: BoundingSphere.fromVertices(positionArray),
  })

  return GeometryPipeline.computeNormal(geometry)
}

export function createFloodBodyPrimitive(floodDepth, material, bounds, terrainGrid) {
  const geometry = buildFloodBodyGeometry(bounds, terrainGrid, floodDepth)
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
