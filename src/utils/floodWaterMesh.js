import {
  Cartesian3,
  ComponentDatatype,
  Geometry,
  GeometryAttribute,
  GeometryInstance,
  GeometryPipeline,
  MaterialAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  Primitive,
  PrimitiveType,
  BoundingSphere,
} from 'cesium'
import { boundsToDegreesArray, lonLatFromUV } from './floodViewBounds'
import { createFloodBodyMaterialFromShader } from './floodWaterMaterial'

export { FLOOD_HALF_SIZE_DEG } from './floodViewBounds'

/** @typedef {import('./floodViewBounds').FloodBounds} FloodBounds */

export const createFloodHierarchy = (bounds) =>
  new PolygonHierarchy(Cartesian3.fromDegreesArray(boundsToDegreesArray(bounds)))

/** 물리 시뮬레이션 결과로 수면 Geometry 생성 (정점 높이 = baseLevel + wave) */
export function buildWaterSurfaceGeometry(waveEngine, baseLevelMeters, bounds) {
  const res = waveEngine.resolution
  const vertexCount = res * res
  const positions = new Float64Array(vertexCount * 3)
  const sts = new Float32Array(vertexCount * 2)
  const indices = []

  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const u = i / (res - 1)
      const v = j / (res - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      const wave = waveEngine.heights[j * res + i]
      const cartesian = Cartesian3.fromDegrees(lon, lat, baseLevelMeters + wave)

      const pi = (j * res + i) * 3
      positions[pi] = cartesian.x
      positions[pi + 1] = cartesian.y
      positions[pi + 2] = cartesian.z

      const si = (j * res + i) * 2
      sts[si] = u
      sts[si + 1] = v
    }
  }

  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i
      const b = a + 1
      const c = a + res
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

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

export function createWaterSurfacePrimitive(waveEngine, baseLevelMeters, material, bounds) {
  const geometry = buildWaterSurfaceGeometry(waveEngine, baseLevelMeters, bounds)
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

/** 수면 아래 정적 부피 (extruded) */
export function createFloodBodyPrimitive(waterLevel, material, bounds) {
  const geometry = new PolygonGeometry({
    polygonHierarchy: createFloodHierarchy(bounds),
    height: 0,
    extrudedHeight: waterLevel,
    vertexFormat: MaterialAppearance.VERTEX_FORMAT,
  })

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
