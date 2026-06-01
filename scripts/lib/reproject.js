import proj4 from 'proj4'

/** KGD2002 Unified (from data/*.prj) → WGS84 */
proj4.defs(
  'EPSG:5179',
  '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +units=m +no_defs',
)

const fromEpsg5179 = proj4('EPSG:5179', 'EPSG:4326')

/** @param {[number, number]} coord */
export function reprojectCoord(coord) {
  const [lon, lat] = fromEpsg5179.forward(coord)
  return [lon, lat]
}

/** @param {import('geojson').Position} position */
function reprojectPosition(position) {
  if (position.length >= 2) {
    const [lon, lat] = reprojectCoord([position[0], position[1]])
    return position.length > 2 ? [lon, lat, ...position.slice(2)] : [lon, lat]
  }
  return position
}

/** @param {import('geojson').Position[][]} rings */
function reprojectRings(rings) {
  return rings.map((ring) => ring.map(reprojectPosition))
}

/**
 * @param {import('geojson').Geometry | null} geometry
 * @returns {import('geojson').Geometry | null}
 */
export function reprojectGeometry(geometry) {
  if (!geometry) return null

  switch (geometry.type) {
    case 'Point':
      return { type: 'Point', coordinates: reprojectPosition(geometry.coordinates) }
    case 'MultiPoint':
      return {
        type: 'MultiPoint',
        coordinates: geometry.coordinates.map(reprojectPosition),
      }
    case 'LineString':
      return {
        type: 'LineString',
        coordinates: geometry.coordinates.map(reprojectPosition),
      }
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: geometry.coordinates.map((line) => line.map(reprojectPosition)),
      }
    case 'Polygon':
      return { type: 'Polygon', coordinates: reprojectRings(geometry.coordinates) }
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(reprojectRings),
      }
    case 'GeometryCollection':
      return {
        type: 'GeometryCollection',
        geometries: geometry.geometries.map((g) => reprojectGeometry(g)),
      }
    default:
      return geometry
  }
}

/**
 * @param {import('geojson').Feature} feature
 * @returns {import('geojson').Feature}
 */
export function reprojectFeature(feature) {
  return {
    ...feature,
    geometry: reprojectGeometry(feature.geometry),
  }
}
