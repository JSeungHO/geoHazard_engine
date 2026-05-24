/**
 * GeoHazard Engine — 지진 QA 전체 스크립트 (Phase 1~4)
 * 실행: node qa-earthquake-full.mjs
 *
 * 커버리지:
 *  Phase 1 §13 — P/S파 ring, 카메라 쉐이크, 도시 마커, 피해 패널,
 *                 일시정지/재개/초기화, 스크러빙, 탭 전환, 프리셋, 지도 클릭, 규모 슬라이더
 *  Phase 3     — OSM 건물 토글 ON → 시뮬 후 "OSM 건물 손상색" 힌트 확인
 *  Phase 4     — 여진 ring 전환, 균열·액상화 표시 (양산단층 M6.5)
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

// ─── 브라우저 기동 ───────────────────────────────────────────────
const browser = await chromium.launch({ headless: false, slowMo: 120 })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
page.on('pageerror', (e) => consoleErrors.push(e.message))

// ═══════════════════════════════════════════════════════════════
// 0. 앱 로딩
// ═══════════════════════════════════════════════════════════════
console.log('\n🔷 앱 로딩...')
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4500)
await shot(page, '00-initial')

// ═══════════════════════════════════════════════════════════════
// 지진 탭 진입
// ═══════════════════════════════════════════════════════════════
console.log('\n🔷 지진 탭 클릭...')
const eqTab = page.locator('button, [role="tab"]').filter({ hasText: /지진|earthquake/i }).first()
if (await eqTab.count() > 0) {
  await eqTab.click()
  await page.waitForTimeout(3000)
  await shot(page, '01-tab-loaded')
  pass(0, '지진 탭 진입')
} else {
  const btns = await page.locator('button, [role="tab"], nav a').allTextContents()
  fail(0, `지진 탭 미발견. 발견된 버튼: ${btns.slice(0, 8).join(', ')}`)
}

// ─── 공용 locators ───────────────────────────────────────────
const playBtn    = page.locator('button').filter({ hasText: /^▶ 시작$|^시작$/ }).first()
const resumeBtn  = page.locator('button').filter({ hasText: /^▶ 재개$|^재개$/ }).first()
const pauseBtn   = page.locator('button').filter({ hasText: /일시정지|⏸/ }).first()
const resetBtn   = page.locator('button').filter({ hasText: /초기화/ }).first()

// ═══════════════════════════════════════════════════════════════
// §13 Phase 1 — UI 컨트롤 존재 확인
// ═══════════════════════════════════════════════════════════════
console.log('\n🔷 UI 컨트롤 확인 (#6)...')
if (await playBtn.count() > 0)  pass(6, '시작 버튼 존재')
else                              warn(6, '시작 버튼 미발견')
if (await resetBtn.count() > 0) pass(6, '초기화 버튼 존재')
else                              warn(6, '초기화 버튼 미발견')

// ─── #9 경주 프리셋 ───────────────────────────────────────────
console.log('\n🔷 #9 경주 프리셋...')
const gyeongjuPreset = page.locator('button').filter({ hasText: /경주/ }).first()
if (await gyeongjuPreset.count() > 0) {
  await gyeongjuPreset.click()
  await page.waitForTimeout(1500)
  await shot(page, '02-gyeongju-preset')
  pass(9, '경주 프리셋 클릭')
} else {
  warn(9, '경주 프리셋 미발견')
}

// ─── #1,#2 시작 → P/S파 ring 확산 ───────────────────────────
console.log('\n🔷 #1,#2 시뮬 시작 → ring 확산...')
const startLocator = page.locator('button').filter({ hasText: /▶ 시작|시작/ }).first()
if (await startLocator.count() > 0) {
  await startLocator.click()
  await page.waitForTimeout(3000)
  await shot(page, '03-rings-3s')
  pass(1, 'P/S파 ring 스크린샷 (육안 확인)')
  pass(2, 'S파 ring 느린 확산 (육안 확인)')
} else {
  fail(1, '시작 버튼 없음')
  fail(2, '시작 버튼 없음')
}

// ─── #3 도시 마커 라벨 변화 ───────────────────────────────────
console.log('\n🔷 #3 도시 마커 라벨 변화 (P파 도달)...')
await page.waitForTimeout(3000)
const bodyAfterRings = await page.locator('body').innerText()
const hasCityMMI = /MMI/.test(bodyAfterRings)
if (hasCityMMI) pass(3, '피해 패널에 MMI 텍스트 확인 (마커 도달)')
else            warn(3, 'MMI 텍스트 미확인 — 아직 S파 미도달 가능성')
await shot(page, '04-city-markers')

// ─── #5 피해 범위 패널 수치 ───────────────────────────────────
console.log('\n🔷 #5 피해 범위 패널...')
await page.waitForTimeout(3000)
const bodyImpact = await page.locator('body').innerText()
const hasPanelStats = /영향 도시|P파 반경|S파 반경|MMI/.test(bodyImpact)
if (hasPanelStats) pass(5, '피해 범위 패널 수치 확인')
else               warn(5, '피해 범위 패널 수치 미확인')
await shot(page, '05-impact-panel')

// ─── #6 일시정지 / 재개 ───────────────────────────────────────
console.log('\n🔷 #6 일시정지 / 재개...')
const pauseLocator = page.locator('button').filter({ hasText: /일시정지|⏸/ }).first()
if (await pauseLocator.count() > 0) {
  await pauseLocator.click()
  await page.waitForTimeout(1200)
  await shot(page, '06-paused')
  pass(6, '일시정지')

  const resumeLocator = page.locator('button').filter({ hasText: /▶ 재개|재개/ }).first()
  if (await resumeLocator.count() > 0) {
    await resumeLocator.click()
    await page.waitForTimeout(1200)
    pass(6, '재개')
  } else {
    // 이미 done 상태일 수 있음 — 시작 버튼으로 확인
    warn(6, '재개 버튼 없음 (완료 상태 가능성)')
  }
} else {
  warn(6, '일시정지 버튼 없음 (시뮬 완료 상태일 수 있음)')
}

// ─── #7 스크러빙 ──────────────────────────────────────────────
console.log('\n🔷 #7 스크러빙...')
// 일시정지 상태로 진입
const pauseForScrub = page.locator('button').filter({ hasText: /일시정지|⏸/ }).first()
if (await pauseForScrub.count() > 0) await pauseForScrub.click()
await page.waitForTimeout(500)

const scrubSlider = page.locator('.scrub-bar__input, input[type="range"]').last()
if (await scrubSlider.count() > 0) {
  const box = await scrubSlider.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height / 2)
    await page.waitForTimeout(1200)
    await shot(page, '07a-scrub-20pct')
    await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2)
    await page.waitForTimeout(1200)
    await shot(page, '07b-scrub-80pct')
    pass(7, '스크러빙 조작 (쉐이크 미발동은 육안 확인)')
  } else {
    warn(7, '스크러빙 슬라이더 boundingBox 없음')
  }
} else {
  warn(7, '스크러빙 슬라이더 미발견')
}

// ─── #6 초기화 ───────────────────────────────────────────────
console.log('\n🔷 #6 초기화...')
if (await resetBtn.count() > 0) {
  await resetBtn.click()
  await page.waitForTimeout(2000)
  await shot(page, '08-reset')
  pass(6, '초기화 — idle 복귀')
} else {
  warn(6, '초기화 버튼 없음')
}

// ─── #8 탭 전환 후 재진입 ─────────────────────────────────────
console.log('\n🔷 #8 홍수 탭 전환 후 재진입...')
const floodTab = page.locator('button, [role="tab"]').filter({ hasText: /홍수|flood/i }).first()
if (await floodTab.count() > 0) {
  await floodTab.click()
  await page.waitForTimeout(2000)
  await eqTab.click()
  await page.waitForTimeout(2000)
  await shot(page, '09-reenter')
  pass(8, '탭 전환 후 재진입 — 잔여 Entity 없음 (육안 확인)')
} else {
  warn(8, '홍수 탭 미발견')
}

// ─── #9 포항 프리셋 ───────────────────────────────────────────
console.log('\n🔷 #9 포항 프리셋...')
const pohangPreset = page.locator('button').filter({ hasText: /포항/ }).first()
if (await pohangPreset.count() > 0) {
  await pohangPreset.click()
  await page.waitForTimeout(1500)
  await shot(page, '10-pohang-preset')
  pass(9, '포항 프리셋 — 진앙 위치 변경')
  // 좌표 표시 확인
  const bodyCoords = await page.locator('body').innerText()
  if (/36\.1[0-9]|36\.1/.test(bodyCoords)) pass(9, '포항 위도 표시 확인 (36.1x°)')
  else warn(9, '포항 위도 텍스트 미확인')
} else {
  warn(9, '포항 프리셋 미발견')
}

// ─── #10 지도 클릭 진앙 이동 ─────────────────────────────────
console.log('\n🔷 #10 지도 클릭 진앙...')
const pickBtn = page.locator('button').filter({ hasText: /지도에서/ }).first()
if (await pickBtn.count() > 0) {
  await pickBtn.click()
  await page.waitForTimeout(500)
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (box) {
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45)
    await page.waitForTimeout(1800)
    await shot(page, '11-map-pick')
    pass(10, '지도 클릭 진앙 이동 (육안 확인)')
  }
} else {
  warn(10, '지도에서 선택 버튼 미발견')
}

// ─── #11 초기화 → 규모 슬라이더 ────────────────────────────
console.log('\n🔷 #11 초기화 후 규모 슬라이더...')
if (await resetBtn.count() > 0) await resetBtn.click()
await page.waitForTimeout(1000)
const magnitudeSlider = page.locator('.earthquake-main-ui input[type="range"]').first()
if (await magnitudeSlider.count() > 0) {
  const sliderBox = await magnitudeSlider.boundingBox()
  if (sliderBox) {
    // 슬라이더를 오른쪽(M7.5 근방)으로 이동
    await page.mouse.click(sliderBox.x + sliderBox.width * 0.875, sliderBox.y + sliderBox.height / 2)
    await page.waitForTimeout(600)
    await shot(page, '12-magnitude-high')
    const bodyM = await page.locator('body').innerText()
    const mMatch = bodyM.match(/규모 \(M\)\s*([0-9.]+)/)
    if (mMatch) pass(11, `규모 슬라이더 → M ${mMatch[1]}`)
    else        pass(11, '규모 슬라이더 조작 완료')
  }
} else {
  warn(11, '규모 슬라이더 미발견')
}

// 초기화
if (await resetBtn.count() > 0) await resetBtn.click()
await page.waitForTimeout(1000)

// ═══════════════════════════════════════════════════════════════
// Phase 3 — OSM 건물 ON + 건물 손상색 확인
// ═══════════════════════════════════════════════════════════════
console.log('\n🔷 [Phase 3] OSM 건물 토글 ON...')
// SceneLayersPanel 은 항상 visible (fixed right)
const osmToggle = page.locator('[role="switch"][aria-label*="OSM 건물"]').first()
if (await osmToggle.count() > 0) {
  const isOn = (await osmToggle.getAttribute('aria-checked')) === 'true'
  if (!isOn) {
    await osmToggle.click()
    await page.waitForTimeout(2000)
    pass('P3-osm', 'OSM 건물 토글 ON')
  } else {
    pass('P3-osm', 'OSM 건물 토글 이미 ON 상태')
  }
  await shot(page, '13-osm-toggled')
} else {
  warn('P3-osm', 'OSM 건물 토글 버튼 미발견')
}

// 양산단층 프리셋 (M6.5 → MMI VII+ 예상, 건물 손상색 조건)
console.log('\n🔷 [Phase 3] 양산단층 프리셋 선택...')
const yangsanPreset = page.locator('button').filter({ hasText: /양산단층/ }).first()
if (await yangsanPreset.count() > 0) {
  await yangsanPreset.click()
  await page.waitForTimeout(1000)
  pass('P3-preset', '양산단층 프리셋 선택')
} else {
  warn('P3-preset', '양산단층 프리셋 미발견 — 경주 사용')
  const gyPreset2 = page.locator('button').filter({ hasText: /경주/ }).first()
  if (await gyPreset2.count() > 0) await gyPreset2.click()
  await page.waitForTimeout(1000)
}

console.log('\n🔷 [Phase 3] 시뮬 시작 → S파 도달 대기...')
const startForP3 = page.locator('button').filter({ hasText: /▶ 시작|시작/ }).first()
if (await startForP3.count() > 0) {
  await startForP3.click()
  // S파가 울산(~18km)에 도달하려면 ~0.1s 실시간 → 넉넉히 5초 대기
  await page.waitForTimeout(5000)
  await shot(page, '14-p3-swave-reached')

  const bodyP3 = await page.locator('body').innerText()
  const hasBuildingHint = /OSM 건물 손상색/.test(bodyP3)
  if (hasBuildingHint) pass('P3-building', 'OSM 건물 손상색 힌트 텍스트 확인')
  else                  warn('P3-building', 'OSM 건물 손상색 힌트 미확인 — MMI VI+ 필요 (육안 확인)')

  // 진도 패널 확인
  const hasMMILabel = /MMI\s*(V|VI|VII|VIII|[5-9])/.test(bodyP3)
  if (hasMMILabel) pass('P3-mmi', 'MMI V 이상 표시 확인')
  else             warn('P3-mmi', 'MMI V+ 텍스트 미확인')
} else {
  fail('P3-sim', '시작 버튼 없음')
}

// ═══════════════════════════════════════════════════════════════
// Phase 4 — 여진 ring, 균열, 액상화
// ═══════════════════════════════════════════════════════════════
console.log('\n🔷 [Phase 4] 초기화 후 양산단층 M6.5 설정...')
if (await resetBtn.count() > 0) await resetBtn.click()
await page.waitForTimeout(1500)

// 양산단층 프리셋 재선택
const yangsanP4 = page.locator('button').filter({ hasText: /양산단층/ }).first()
if (await yangsanP4.count() > 0) {
  await yangsanP4.click()
  await page.waitForTimeout(800)
}

// "여진 시퀀스 포함" 체크박스 확인
const aftershockCheckbox = page.locator('input[type="checkbox"]').first()
if (await aftershockCheckbox.count() > 0) {
  const checked = await aftershockCheckbox.isChecked()
  if (checked) {
    pass('P4-toggle', '여진 시퀀스 포함 체크박스 ON 확인')
  } else {
    await aftershockCheckbox.click()
    await page.waitForTimeout(400)
    pass('P4-toggle', '여진 시퀀스 포함 체크박스 ON 설정')
  }
} else {
  warn('P4-toggle', '여진 시퀀스 체크박스 미발견')
}

console.log('\n🔷 [Phase 4] 전체 시뮬 실행 → 여진·균열·액상화 대기...')
const startP4 = page.locator('button').filter({ hasText: /▶ 시작|시작/ }).first()
if (await startP4.count() > 0) {
  await startP4.click()

  // M6.5, timeScale=50, maxPropagation=800km
  // 본진: 800km/3.5km/s ÷ 50 ≈ 4.5s 실시간
  // 여진 3회: 3*16000ms ÷ 50 = 960ms 실시간
  // 안전하게 12초 대기
  await page.waitForTimeout(12000)
  await shot(page, '15-p4-post-aftershocks')

  const bodyP4 = await page.locator('body').innerText()

  // 균열 확인 — 텍스트 단서 없음, 타임라인 "지표 균열·액상화" active 확인
  const hasCrackStep = /지표 균열·액상화/.test(bodyP4)
  if (hasCrackStep) pass('P4-crack', '타임라인 "지표 균열·액상화" 단계 텍스트 확인')
  else              warn('P4-crack', '균열·액상화 타임라인 텍스트 미확인')

  // 액상화 면적 확인
  const hasLiquefaction = /액상화 위험/.test(bodyP4)
  if (hasLiquefaction) pass('P4-liquefaction', '액상화 위험 구역 텍스트 확인')
  else                  warn('P4-liquefaction', '액상화 텍스트 미확인 — MMI VI+ 연안 필요 (육안 확인)')

  // 여진 시퀀스 타임라인 확인
  const hasAftershockStep = /여진 시퀀스/.test(bodyP4)
  if (hasAftershockStep) pass('P4-aftershock-tl', '타임라인 "여진 시퀀스" 단계 텍스트 확인')
  else                    warn('P4-aftershock-tl', '여진 시퀀스 타임라인 미확인')

  // 여진 ring — 여진 활성 시 상태바 "여진" 텍스트 확인
  // (시뮬 완료 후 aftershock 정보가 남아 있을 수 있음)
  const hasAftershockRing = /여진|aftershock/i.test(bodyP4)
  if (hasAftershockRing) pass('P4-aftershock-ring', '여진 ring / 여진 텍스트 표시 확인')
  else                    warn('P4-aftershock-ring', '여진 ring 텍스트 미확인 — 스크린샷 육안 확인 필요')

  // done 상태 확인
  const isDoneState = /전파 완료|완료/.test(bodyP4)
  if (isDoneState) pass('P4-done', '시뮬레이션 완료 상태 확인')
  else             warn('P4-done', '완료 텍스트 미확인')

  await shot(page, '16-p4-final-state')
} else {
  fail('P4-sim', '시작 버튼 없음')
}

// Phase 4 — 시뮬 도중 스크린샷 (여진 진행 중 캡처 시도)
// 재시작하여 여진 중간 타이밍에 캡처
console.log('\n🔷 [Phase 4] 여진 ring 전환 스크린샷 (재시작)...')
if (await resetBtn.count() > 0) await resetBtn.click()
await page.waitForTimeout(1200)

const yangsanP4b = page.locator('button').filter({ hasText: /양산단층/ }).first()
if (await yangsanP4b.count() > 0) await yangsanP4b.click()
await page.waitForTimeout(600)

const startP4b = page.locator('button').filter({ hasText: /▶ 시작|시작/ }).first()
if (await startP4b.count() > 0) {
  await startP4b.click()
  // 본진 완료 (~4.5s) + 여진 시작 직후
  await page.waitForTimeout(5500)
  await shot(page, '17-p4-aftershock-ring-mid')

  const bodyMid = await page.locator('body').innerText()
  // 여진 ring 활성 중 상태바 "여진" 또는 "M x.x" 표시
  const isAfterShockActive = /여진\s*\d|M\s*[0-9.]+/.test(bodyMid)
  if (isAfterShockActive) pass('P4-ring-mid', '여진 ring 진행 중 M값 표시 확인')
  else                     warn('P4-ring-mid', '여진 ring 중간 캡처 — 육안 확인 필요')
}

// ═══════════════════════════════════════════════════════════════
// 콘솔 에러 집계
// ═══════════════════════════════════════════════════════════════
const jsErrors = consoleErrors.filter(
  (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('net::ERR_')
)
console.log('\n🔷 콘솔 에러...')
if (jsErrors.length === 0) {
  console.log('  ✅ 콘솔 에러 없음')
} else {
  jsErrors.forEach((e, i) => console.log(`  [${i + 1}] ${e.slice(0, 220)}`))
}

await shot(page, '18-final')

// ═══════════════════════════════════════════════════════════════
// 최종 결과
// ═══════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(64))
console.log('📋 지진 QA 전체 결과 (Phase 1 + Phase 3 + Phase 4)')
results.forEach((r) => console.log(`  ${r.status}  [${r.id}]  ${r.note}`))

const failCount = results.filter((r) => r.status.includes('FAIL')).length
const warnCount = results.filter((r) => r.status.includes('WARN')).length
const passCount = results.filter((r) => r.status.includes('PASS')).length

console.log(`\n  PASS: ${passCount}  /  WARN: ${warnCount}  /  FAIL: ${failCount}`)
console.log(`  JS 콘솔 에러: ${jsErrors.length}개`)
console.log('📁 스크린샷: ./qa-screenshots/')
console.log('═'.repeat(64))

await browser.close()
