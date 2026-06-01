#!/usr/bin/env node
/**
 * Copy gangnam clip GeoJSON to public/ for Vite deploy.
 */
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'data', 'geojson')
const DEST = path.join(ROOT, 'public', 'data', 'seoul-flood-2022-gangnam.geojson')

const entries = await readdir(SRC_DIR)
const sourceName = entries.find((name) => name.endsWith('-gangnam.geojson'))

if (!sourceName) {
  console.error('Run npm run data:shp2geojson first (no *-gangnam.geojson in data/geojson/)')
  process.exit(1)
}

await mkdir(path.dirname(DEST), { recursive: true })
await copyFile(path.join(SRC_DIR, sourceName), DEST)
console.log(`Copied ${sourceName} → public/data/seoul-flood-2022-gangnam.geojson`)
