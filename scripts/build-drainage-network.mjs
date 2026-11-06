#!/usr/bin/env node
/**
 * 강남역 일대 추정 배수망 생성 — OpenStreetMap 도로망 기반
 *
 *   npm run data:drainage                 # Overpass API에서 도로망 조회 (인터넷 필요)
 *   npm run data:drainage -- --input f.json   # 저장해 둔 Overpass 응답 사용
 *
 * 출력: public/data/gangnam-drainage-network.json
 * 도로 데이터 © OpenStreetMap contributors (ODbL 1.0)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bboxAroundPoint } from './lib/bbox.js'
import {
  DRAINAGE_ROAD_CLASSES,
  INLET_SPACING_M,
  MANHOLE_SPACING_M,
  buildDrainageGeometry,
  waysFromOverpass,
} from './lib/drainageGeometry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'public', 'data', 'gangnam-drainage-network.json')
const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'

/** 강남역 중심 — 침수흔적도 클립과 같은 기준점, 반경 약 0.9 km */
const CENTER = { lon: 127.0267, lat: 37.4975 }
const PADDING_DEG = 0.008

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d

async function fetchOverpass(bbox) {
  const classes = DRAINAGE_ROAD_CLASSES.join('|')
  const query = `[out:json][timeout:90];way["highway"~"^(${classes})$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});out geom;`
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'geohazard-engine-data-script' },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function main() {
  const inputIdx = process.argv.indexOf('--input')
  const bbox = bboxAroundPoint(CENTER.lon, CENTER.lat, PADDING_DEG)
  const overpass = inputIdx > 0
    ? JSON.parse(await readFile(path.resolve(process.argv[inputIdx + 1]), 'utf8'))
    : await fetchOverpass(bbox)

  const ways = waysFromOverpass(overpass)
  const geom = buildDrainageGeometry(ways, bbox)

  const output = {
    meta: {
      description: '강남역 일대 추정 우수 배수망 — 도로 중심선을 관로 경로로 가정 (실측 관로 아님)',
      attribution: '도로 데이터 © OpenStreetMap contributors (ODbL 1.0)',
      generatedAt: new Date().toISOString(),
      osmTimestamp: overpass.osm3s?.timestamp_osm_base ?? null,
      bbox,
      assumptions: {
        manholeSpacingM: MANHOLE_SPACING_M,
        inletSpacingM: INLET_SPACING_M,
        roadClasses: DRAINAGE_ROAD_CLASSES,
        catchment: '대상 영역 면적을 노드별 인접 도로 길이 비율로 배분',
      },
      wayCount: ways.length,
      areaM2: Math.round(geom.areaM2),
      totalRoadLengthM: Math.round(geom.totalRoadLengthM),
    },
    nodes: geom.nodes.map((n) => ({
      id: n.id,
      lon: round(n.lon, 7),
      lat: round(n.lat, 7),
      inletCount: n.inletCount,
      catchmentAreaM2: Math.round(n.catchmentAreaM2),
    })),
    links: geom.links.map((l) => ({ id: l.id, a: l.a, b: l.b, lengthM: round(l.lengthM, 1), roadClass: l.roadClass })),
  }

  await mkdir(path.dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`, 'utf8')
  console.log('추정 배수망 생성')
  console.log(`  도로 ${ways.length}개 · 총 연장 ${(geom.totalRoadLengthM / 1000).toFixed(1)} km`)
  console.log(`  맨홀 ${output.nodes.length}개 · 관로 ${output.links.length}개`)
  console.log(`  빗물받이 ${output.nodes.reduce((s, n) => s + n.inletCount, 0)}개 (추정)`)
  console.log(`  → ${path.relative(ROOT, OUTPUT)}`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
