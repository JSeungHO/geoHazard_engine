#!/usr/bin/env node
/**
 * Shapefile (EPSG:5179) → GeoJSON (WGS84) converter for local flood trace data.
 *
 * Usage:
 *   npm run data:shp2geojson
 *   npm run data:shp2geojson -- --all
 *   npm run data:shp2geojson -- --input data/foo.shp --output data/geojson/foo.geojson
 *   npm run data:shp2geojson -- --bbox 127.01,37.48,127.04,37.51
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { open } from 'shapefile'
import { bboxAroundPoint, featureInBBox } from './lib/bbox.js'
import { readShapefileEncoding } from './lib/encoding.js'
import { reprojectFeature } from './lib/reproject.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'data')
const DEFAULT_OUTPUT_DIR = path.join(DATA_DIR, 'geojson')

/** @see src/locations/gangnam.js — script avoids Cesium import */
const GANGNAM = { lon: 127.0267, lat: 37.4975 }

const GANGNAM_PADDING_DEG = 0.012 // ~1.3 km — 강남역 주변 침수흔적

function printHelp() {
  console.log(`
Shapefile → GeoJSON (EPSG:5179 → WGS84)

Options:
  --input <path>     .shp path (default: first *.shp in data/)
  --output <path>    output .geojson (default: data/geojson/<basename>.geojson)
  --gangnam          clip to 강남역 bbox (default)
  --all              include all features (no bbox clip)
  --bbox w,s,e,n     custom WGS84 bbox in degrees
  --help             show this help
`)
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ input?: string, output?: string, mode: 'gangnam' | 'all' | 'bbox', bbox?: import('./lib/bbox.js').BBox }} */
  const opts = { mode: 'gangnam' }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      opts.help = true
    } else if (arg === '--input') {
      opts.input = path.resolve(argv[++i])
    } else if (arg === '--output') {
      opts.output = path.resolve(argv[++i])
    } else if (arg === '--all') {
      opts.mode = 'all'
    } else if (arg === '--gangnam') {
      opts.mode = 'gangnam'
    } else if (arg === '--bbox') {
      const parts = argv[++i]?.split(',').map(Number)
      if (!parts || parts.length !== 4 || parts.some(Number.isNaN)) {
        throw new Error('--bbox requires west,south,east,north (four numbers)')
      }
      opts.mode = 'bbox'
      opts.bbox = { west: parts[0], south: parts[1], east: parts[2], north: parts[3] }
    } else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return opts
}

async function findDefaultShapefile() {
  const entries = await readdir(DATA_DIR)
  const shp = entries.find((name) => name.toLowerCase().endsWith('.shp'))
  if (!shp) {
    throw new Error(`No .shp found in ${DATA_DIR}. Place shapefile there or pass --input.`)
  }
  return path.join(DATA_DIR, shp)
}

/**
 * @param {import('./lib/bbox.js').BBox | undefined} filterBBox
 * @param {import('geojson').Feature} feature
 */
function passesFilter(filterBBox, feature) {
  if (!filterBBox) return true
  return featureInBBox(feature, filterBBox)
}

/**
 * @param {ReturnType<typeof parseArgs>} opts
 */
function resolveFilterBBox(opts) {
  if (opts.mode === 'all') return null
  if (opts.mode === 'bbox') return opts.bbox ?? null
  return bboxAroundPoint(GANGNAM.lon, GANGNAM.lat, GANGNAM_PADDING_DEG)
}

async function convertShapefile(opts) {
  const inputPath = opts.input ?? await findDefaultShapefile()
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const suffix = opts.mode === 'all' ? '' : opts.mode === 'gangnam' ? '-gangnam' : '-clip'
  const outputPath = opts.output ?? path.join(DEFAULT_OUTPUT_DIR, `${baseName}${suffix}.geojson`)
  const filterBBox = resolveFilterBBox(opts)

  await mkdir(path.dirname(outputPath), { recursive: true })

  const encoding = await readShapefileEncoding(inputPath)
  const source = await open(inputPath, undefined, { encoding })
  /** @type {import('geojson').Feature[]} */
  const features = []
  let read = 0
  let kept = 0

  while (true) {
    const result = await source.read()
    if (result.done) break
    read += 1

    const projected = reprojectFeature(result.value)
    if (!passesFilter(filterBBox, projected)) continue

    features.push(projected)
    kept += 1
  }

  /** @type {import('geojson').FeatureCollection} */
  const collection = {
    type: 'FeatureCollection',
    name: baseName,
    features,
  }

  await writeFile(outputPath, `${JSON.stringify(collection)}\n`, 'utf8')

  return { inputPath, outputPath, read, kept, filterBBox, encoding }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const { inputPath, outputPath, read, kept, filterBBox, encoding } = await convertShapefile(opts)

  console.log('Shapefile → GeoJSON')
  console.log(`  input:  ${inputPath}`)
  console.log(`  output: ${outputPath}`)
  console.log(`  encoding: ${encoding}`)
  console.log(`  read:   ${read} features`)
  console.log(`  kept:   ${kept} features`)
  if (filterBBox) {
    console.log(
      `  bbox:   W ${filterBBox.west.toFixed(5)}, S ${filterBBox.south.toFixed(5)}, `
        + `E ${filterBBox.east.toFixed(5)}, N ${filterBBox.north.toFixed(5)}`,
    )
  } else {
    console.log('  bbox:   (none — all features)')
  }
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
