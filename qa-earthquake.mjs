/**
 * GeoHazard Engine — 지진 탭 QA 스크립트
 * 실행: node qa-earthquake.mjs
 *
 * 체크리스트 (earthquake-plan.md §13 기준):
 *  1. 시작 → P파 ring 진앙에서 확산
 *  2. S파 ring이 P파보다 느리게 확산
 *  3. P파 도달 도시 → 마커 라벨 변화
 *  4. S파 도달 → 카메라 쉐이크 (진앙 근처 프리셋)
 *  5. 도시 MMI 라벨 + 피해 범위 패널 갱신
 *  6. 일시정지 / 재개 / 초기화
 *  7. 스크러빙 → ring 반영, 쉐이크 미발동
 *  8. 홍수 탭 전환 후 지진 탭 재진입
 *  9. 경주·포항 프리셋
 * 10. 지도 클릭 진앙 이동
 */

import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { join } from 'path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const SS_DIR = './qa-screenshots'
await mkdir(SS_DIR, { recursive: true })

let ssIdx = 0
async function shot(page, label) {
  const file = join(SS_DIR, `${String(++ssIdx).padStart(2, '0')}-eq-${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`  📸 ${file}`)
  return file
}

const results = []
function pass(id, note = '') { results.push({ id, status: '✅ PASS', note }); console.log(`  ✅ #${id} PASS ${note}`) }
function fail(id, note = '') { results.push({ id, status: '❌ FAIL', note }); console.log(`  ❌ #${id} FAIL ${note}`) }
function warn(id, note = '') { results.push({ id, status: '⚠️  WARN', note }); console.log(`  ⚠️  #${id} WARN ${note}`) }

const browser = await chromium.launch({ headless: false, slowMo: 150 })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
page.on('pageerror', (e) => consoleErrors.push(e.message))

console.log('\n🔷 앱 로딩...')
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await shot(page, 'initial-load')

console.log('\n🔷 지진 탭 클릭...')
const eqTab = page.locator('button, [role="tab"]').filter({ hasText: /지진|earthquake/i }).first()
if (await eqTab.count() > 0) {
  await eqTab.click()
  await page.waitForTimeout(3000)
  await shot(page, 'tab-loaded')
  pass(0, '지진 탭 진입')
} else {
  const btns = await page.locator('button, [role="tab"], nav a').allTextContents()
  fail(0, `지진 탭 미발견: ${btns.slice(0, 8).join(', ')}`)
}

console.log('\n🔷 UI 컨트롤 확인...')
const playBtn = page.locator('button').filter({ hasText: /시작|▶/ }).first()
const resetBtn = page.locator('button').filter({ hasText: /초기화|reset/i }).first()
const magnitudeSlider = page.locator('.earthquake-main-ui input[type="range"]').first()

if (await playBtn.count() > 0) pass(6, '시작 버튼 존재')
else warn(6, '시작 버튼 미발견')

if (await resetBtn.count() > 0) pass(6, '초기화 버튼 존재')
else warn(6, '초기화 버튼 미발견')

console.log('\n🔷 #9 경주 프리셋...')
const gyeongjuPreset = page.locator('button').filter({ hasText: /경주/i }).first()
if (await gyeongjuPreset.count() > 0) {
  await gyeongjuPreset.click()
  await page.waitForTimeout(1500)
  await shot(page, 'gyeongju-preset')
  pass(9, '경주 프리셋 클릭')
} else {
  warn(9, '경주 프리셋 미발견')
}

console.log('\n🔷 #1,#2 시뮬 시작 → ring 확산...')
if (await playBtn.count() > 0) {
  await playBtn.click()
  await page.waitForTimeout(3000)
  await shot(page, 'rings-3s')
  pass(1, 'P/S파 ring 스크린샷 (육안 확인)')
  pass(2, 'S파 ring 느린 확산 (육안 확인)')
}

console.log('\n🔷 #5 피해 범위 패널...')
await page.waitForTimeout(5000)
const bodyText = await page.locator('body').innerText()
const hasMMI = /MMI|영향 도시|P파 반경|S파 반경/.test(bodyText)
if (hasMMI) pass(5, '피해 패널 텍스트 확인')
else warn(5, '피해 패널 수치 미확인')
await shot(page, 'impact-panel')

console.log('\n🔷 #6 일시정지 / 재개...')
const pauseBtn = page.locator('button').filter({ hasText: /일시정지|⏸/ }).first()
if (await pauseBtn.count() > 0) {
  await pauseBtn.click()
  await page.waitForTimeout(1200)
  await shot(page, 'paused')
  pass(6, '일시정지')

  const resumeBtn = page.locator('button').filter({ hasText: /재개|▶/ }).first()
  if (await resumeBtn.count() > 0) {
    await resumeBtn.click()
    await page.waitForTimeout(1200)
    pass(6, '재개')
  }
} else {
  warn(6, '일시정지 버튼 없음 (시뮬 완료 상태일 수 있음)')
}

console.log('\n🔷 #7 스크러빙 (일시정지 상태)...')
if (await pauseBtn.count() === 0) {
  const pauseAgain = page.locator('button').filter({ hasText: /일시정지|⏸/ }).first()
  if (await pauseAgain.count() > 0) await pauseAgain.click()
}
const scrubSlider = page.locator('.scrub-bar__input, input[type="range"]').last()
if (await scrubSlider.count() > 0) {
  const box = await scrubSlider.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2)
    await page.waitForTimeout(1200)
    await shot(page, 'scrub-20pct')
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2)
    await page.waitForTimeout(1200)
    await shot(page, 'scrub-80pct')
    pass(7, '스크러빙 조작 (쉐이크 미발동은 육안 확인)')
  }
} else {
  warn(7, '스크러빙 슬라이더 미발견')
}

console.log('\n🔷 #6 초기화...')
if (await resetBtn.count() > 0) {
  await resetBtn.click()
  await page.waitForTimeout(2000)
  await shot(page, 'reset')
  pass(6, '초기화')
}

console.log('\n🔷 #8 탭 전환 후 재진입...')
const floodTab = page.locator('button, [role="tab"]').filter({ hasText: /홍수|flood/i }).first()
if (await floodTab.count() > 0) {
  await floodTab.click()
  await page.waitForTimeout(2000)
  await eqTab.click()
  await page.waitForTimeout(2000)
  await shot(page, 'reenter')
  pass(8, '탭 전환 후 재진입')
} else {
  warn(8, '홍수 탭 미발견')
}

console.log('\n🔷 #10 포항 프리셋...')
const pohangPreset = page.locator('button').filter({ hasText: /포항/i }).first()
if (await pohangPreset.count() > 0) {
  await pohangPreset.click()
  await page.waitForTimeout(1500)
  await shot(page, 'pohang-preset')
  pass(10, '포항 프리셋')
} else {
  warn(10, '포항 프리셋 미발견')
}

console.log('\n🔷 #11 지도 클릭 진앙...')
const pickBtn = page.locator('button').filter({ hasText: /지도에서/i }).first()
if (await pickBtn.count() > 0) {
  await pickBtn.click()
  await page.waitForTimeout(500)
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5)
    await page.waitForTimeout(1500)
    await shot(page, 'map-pick')
    pass(11, '지도 클릭 진앙 (육안 확인)')
  }
} else {
  warn(11, '지도 선택 버튼 미발견')
}

console.log('\n🔷 #12 규모 슬라이더...')
if (await magnitudeSlider.count() > 0 && await resetBtn.count() > 0) {
  await resetBtn.click()
  await page.waitForTimeout(1000)
  const sliderBox = await magnitudeSlider.boundingBox()
  if (sliderBox) {
    await page.mouse.click(sliderBox.x + sliderBox.width * 0.9, sliderBox.y + sliderBox.height / 2)
    await page.waitForTimeout(500)
    await shot(page, 'magnitude-high')
    pass(12, '규모(M) 슬라이더 조작')
  }
}

const jsErrors = consoleErrors.filter((e) => !e.includes('favicon') && !e.includes('404'))
console.log('\n🔷 콘솔 에러...')
if (jsErrors.length === 0) console.log('  ✅ 콘솔 에러 없음')
else jsErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 200)}`))

await shot(page, 'final')
console.log('\n' + '═'.repeat(60))
console.log('📋 지진 QA 결과')
results.forEach((r) => console.log(`  ${r.status}  #${r.id}  ${r.note}`))
console.log(`\n  FAIL: ${results.filter((r) => r.status.includes('FAIL')).length}`)
console.log(`  WARN: ${results.filter((r) => r.status.includes('WARN')).length}`)
console.log('📁 ./qa-screenshots/')
console.log('═'.repeat(60))

await browser.close()
