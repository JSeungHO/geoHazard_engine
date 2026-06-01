/** @typedef {{ west: number, south: number, east: number, north: number }} BBox */

/**
 * @param {import('geojson').Position} position
 * @returns {[number, number]}
 */
function lonLat(position) {
  return [position[0], position[1]]
}

/**
 * @param {import('geojson').Geometry | null} geometry
 * @param {(lon: number, lat: number) => void} visit
 */
function visitGeometry(geometry, visit) {
  if (!geometry) return

  switch (geometry.type) {
    case 'Point':
      visit(...lonLat(geometry.coordinates))
      break
    case 'MultiPoint':
    case 'LineString':
      geometry.coordinates.forEach((c) => visit(...lonLat(c)))
      break
    case 'MultiLineString':
    case 'Polygon':
      geometry.coordinates.flat(1).forEach((c) => visit(...lonLat(c)))
      break
    case 'MultiPolygon':
      geometry.coordinates.flat(2).forEach((c) => visit(...lonLat(c)))
      break
    case 'GeometryCollection':
      geometry.geometries.forEach((g) => visitGeometry(g, visit))
      break
    default:
      break
  }
}

/**
 * @param {import('geojson').Feature} feature
 * @returns {BBox | null}
 */
export function featureBBox(feature) {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  let found = false

  visitGeometry(feature.geometry, (lon, lat) => {
    found = true
    west = Math.min(west, lon)
    south = Math.min(south, lat)
    east = Math.max(east, lon)
    north = Math.max(north, lat)
  })

  return found ? { west, south, east, north } : null
}

/**
 * @param {BBox} a
 * @param {BBox} b
 */
export function bboxIntersects(a, b) {
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north)
}

/**
 * @param {number} lon
 * @param {number} lat
 * @param {number} paddingDeg
 * @returns {BBox}
 */
export function bboxAroundPoint(lon, lat, paddingDeg) {
  return {
    west: lon - paddingDeg,
    south: lat - paddingDeg,
    east: lon + paddingDeg,
    north: lat + paddingDeg,
  }
}

/**
 * @param {import('geojson').Feature} feature
 * @param {BBox} bbox
 */
export function featureInBBox(feature, bbox) {
  const fb = featureBBox(feature)
  return fb ? bboxIntersects(fb, bbox) : false
}
