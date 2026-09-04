/**
 * README 스크린샷·GIF 캡처 — dev 서버(npm run dev) 실행 상태에서:
 *   node qa-capture-readme.mjs
 *
 * 산출물 (qa-screenshots/):
 *   flood-gangnam-2022.png      홍수 탭 · 2022 강남역 침수 시나리오
 *   earthquake-ps-wave.png      지진 탭 · P/S파 확산 + MMI + 건물 흔들림
 *   gif-frames/eq-###.png       지진파 확산 프레임 (ffmpeg 입력)
 *
 * GIF 합성:
 *   ffmpeg -y -framerate 10 -i qa-screenshots/gif-frames/eq-%03d.png \
 *     -vf "scale=960:-1:flags=lanczos" qa-screenshots/earthquake-wave.gif
 */
import { chromium } from 'playwright'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const SS = './qa-screenshots'
const FRAMES = join(SS, 'gif-frames')
await mkdir(SS, { recursive: true })
await rm(FRAMES, { recursive: true, force: true })
await mkdir(FRAMES, { recursive: true })

const browser = await chromium.launch({ headless: false, slowMo: 0 })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  pageerror:', e.message))

console.log('앱 로딩...')
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(6000)

// ── 홍수 탭 (기본 탭) · 2022 강남역 ─────────────────────────────
console.log('홍수: 2022 강남역 시나리오...')
const floodTab = page.locator('.module-shell__tab', { hasText: '홍수' }).first()
if (await floodTab.count()) { await floodTab.click(); await page.waitForTimeout(1500) }
const gangnam = page.locator('button.scenario-btn', { hasText: '2022 강남역' }).first()
await gangnam.click()
await page.waitForTimeout(9000) // terrain grid + 침수흔적 overlay 로딩
await page.screenshot({ path: join(SS, 'flood-gangnam-2022.png') })
console.log('  📸 flood-gangnam-2022.png')

// ── 지진 탭 · 경주 프리셋 → 시작 → 파동 프레임 캡처 ───────────
console.log('지진: 경주 프리셋 → 시뮬 시작...')
const eqTab = page.locator('.module-shell__tab', { hasText: '지진' }).first()
await eqTab.click()
await page.waitForTimeout(4000)

const gyeongju = page.locator('button', { hasText: /경주/ }).first()
if (await gyeongju.count()) { await gyeongju.click(); await page.waitForTimeout(1500) }

// OSM 건물 ON (건물 흔들림 연출)
const osm = page.locator('[role="switch"][aria-label*="OSM 건물"]').first()
if (await osm.count() && (await osm.getAttribute('aria-checked')) !== 'true') {
  await osm.click()
  await page.waitForTimeout(3000)
}

const start = page.locator('button', { hasText: /▶ 시작|^시작/ }).first()
await start.click()

// 파동 확산 프레임: 200ms 간격 × 40프레임 ≈ 8초
const N = 40
for (let i = 0; i < N; i++) {
  await page.screenshot({ path: join(FRAMES, `eq-${String(i).padStart(3, '0')}.png`) })
  if (i === 14) await page.screenshot({ path: join(SS, 'earthquake-ps-wave.png') }) // ~3s 히어로 컷
  await page.waitForTimeout(200)
}
console.log(`  📸 earthquake-ps-wave.png + ${N} GIF 프레임`)

await browser.close()
console.log('완료. GIF는 ffmpeg 명령으로 합성하세요 (파일 상단 주석 참고).')
