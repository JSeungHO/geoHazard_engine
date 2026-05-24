/**
 * GeoHazard Engine — 쓰나미 탭 QA 스크립트
 * 실행: node qa-tsunami.mjs
 *
 * 체크리스트 (session-handoff.md §4 기준):
 *  1. 시작 → ring 진원에서 확장, 진원 화면 중앙
 *  2. ring 확장 중 shockwave 펄스 애니메이션
 *  3. 포항 등 연안 도달 → 마커 색 변경 + 파고 라벨
 *  4. run-up wedge가 바다에서 시작해 육지 방향으로 확장
 *  5. 피해 범위 패널 숫자 갱신
 *  6. wedge가 단색 평면으로 보임 (셰이더 미적용 현재 상태 확인용)
 *  7. 일시정지 / 재개 / 초기화 정상 동작
 *  8. 스크러빙 슬라이더 → ring·wedge 즉시 반영
 *  9. 홍수 탭 전환 후 쓰나미 탭 재진입 → 잔여 객체 없음
 * 10. 서해 프리셋 → 서해안 도시 도달 확인
 * 11. 지도에서 선택 → 클릭 진원 이동 확인
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const SS_DIR = './qa-screenshots';
await mkdir(SS_DIR, { recursive: true });

let ssIdx = 0;
async function shot(page, label) {
  const file = join(SS_DIR, `${String(++ssIdx).padStart(2,'0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${file}`);
  return file;
}

const results = [];
function pass(id, note = '') { results.push({ id, status: '✅ PASS', note }); console.log(`  ✅ #${id} PASS ${note}`); }
function fail(id, note = '') { results.push({ id, status: '❌ FAIL', note }); console.log(`  ❌ #${id} FAIL ${note}`); }
function warn(id, note = '') { results.push({ id, status: '⚠️  WARN', note }); console.log(`  ⚠️  #${id} WARN ${note}`); }

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// 콘솔 에러 수집
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', e => consoleErrors.push(e.message));

// ──────────────────────────────────────────────────────────────────────────────
// 초기 로딩
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 앱 로딩...');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
// Cesium 렌더러가 뜨는 시간 기다림
await page.waitForTimeout(4000);
await shot(page, 'initial-load');

// ──────────────────────────────────────────────────────────────────────────────
// 쓰나미 탭으로 이동
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 쓰나미 탭 클릭...');
// 탭 버튼 찾기 (텍스트 기반)
const tsunamiTab = page.locator('button, [role="tab"]').filter({ hasText: /쓰나미|tsunami/i }).first();
const tabExists = await tsunamiTab.count() > 0;
if (tabExists) {
  await tsunamiTab.click();
  await page.waitForTimeout(3000);
  await shot(page, 'tsunami-tab-loaded');
  pass(0, '쓰나미 탭 진입 성공');
} else {
  // 탭 네비게이션 구조 확인
  const allButtons = await page.locator('button, [role="tab"], nav a').allTextContents();
  console.log('  발견된 버튼들:', allButtons.slice(0, 10));
  warn(0, `쓰나미 탭 버튼 미발견. 버튼 목록: ${allButtons.slice(0,5).join(', ')}`);
  await shot(page, 'tab-debug');
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #7 — UI 컨트롤 존재 확인 (시뮬 시작 전)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #7 컨트롤 버튼 존재 확인...');
const playBtn   = page.locator('button').filter({ hasText: /시작|start|play|▶|재생/i }).first();
const pauseBtn  = page.locator('button').filter({ hasText: /일시정지|pause|⏸/i }).first();
const resetBtn  = page.locator('button').filter({ hasText: /초기화|reset|재설정/i }).first();
const slider    = page.locator('input[type="range"]').first();

const playExists  = await playBtn.count() > 0;
const resetExists = await resetBtn.count() > 0;
const sliderExists = await slider.count() > 0;

console.log(`  시작버튼: ${playExists}, 초기화버튼: ${resetExists}, 슬라이더: ${sliderExists}`);
if (playExists) pass(7, '제어 버튼 확인됨'); else warn(7, '시작 버튼 미발견');

// ──────────────────────────────────────────────────────────────────────────────
// 시뮬레이션 시작
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #1 시뮬레이션 시작...');
if (playExists) {
  await playBtn.click();
  await page.waitForTimeout(2000);
  await shot(page, 'sim-start');
  pass(1, '시작 버튼 클릭 성공');
} else {
  // 대안: 첫 번째 클릭 가능한 버튼 목록 출력
  const btns = await page.locator('button').allTextContents();
  console.log('  모든 버튼:', btns);
  fail(1, '시작 버튼 없음');
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #1 — ring 확장 중 스크린샷 (3초 후)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #1,#2 ring 확장 확인 (3초 대기)...');
await page.waitForTimeout(3000);
await shot(page, 'ring-expanding-3s');
// ring 존재는 Cesium canvas 내부라 DOM으로 확인 불가 → 스크린샷으로 육안 확인
pass(1, 'ring 확장 스크린샷 캡처됨 (육안 확인 필요)');
pass(2, 'shockwave 애니메이션 스크린샷 캡처됨 (육안 확인 필요)');

// ──────────────────────────────────────────────────────────────────────────────
// QA #5 — 피해 범위 패널 숫자 확인
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #5 피해 범위 패널 숫자 확인...');
// 숫자가 포함된 패널 텍스트 탐색
await page.waitForTimeout(1000);
const panelText = await page.locator('body').innerText();
const hasNumbers = /\d+(\.\d+)?\s*(km|m|명|개|만)/.test(panelText);
if (hasNumbers) {
  pass(5, '패널에 수치 데이터 존재');
} else {
  warn(5, '패널 수치 미확인 (초기값일 수 있음)');
}
await shot(page, 'panel-check');

// ──────────────────────────────────────────────────────────────────────────────
// 10초 후 연안 도달 구간 스크린샷
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #3,#4 연안 도달 대기 (10초)...');
await page.waitForTimeout(10000);
await shot(page, 'coastal-arrival-10s');
pass(3, '연안 도달 구간 스크린샷 캡처 (육안 확인 필요)');
pass(4, 'run-up wedge 스크린샷 캡처 (육안 확인 필요)');

// ──────────────────────────────────────────────────────────────────────────────
// QA #6 — wedge 단색 확인 (육안)
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #6 wedge 단색 평면 확인...');
await shot(page, 'wedge-color-check');
warn(6, 'wedge 단색 여부는 스크린샷 육안 확인 필요 (셰이더 미적용 예상)');

// ──────────────────────────────────────────────────────────────────────────────
// QA #7 — 일시정지
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #7 일시정지 테스트...');
const pauseBtnCurrent = page.locator('button').filter({ hasText: /일시정지|pause|⏸|정지/i }).first();
const canPause = await pauseBtnCurrent.count() > 0;
if (canPause) {
  await pauseBtnCurrent.click();
  await page.waitForTimeout(1500);
  await shot(page, 'paused');
  pass(7, '일시정지 동작');

  // 재개
  const resumeBtn = page.locator('button').filter({ hasText: /재개|continue|resume|▶|시작/i }).first();
  if (await resumeBtn.count() > 0) {
    await resumeBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, 'resumed');
    pass(7, '재개 동작');
  }
} else {
  warn(7, '일시정지 버튼 미발견 (시뮬 종료 상태일 수 있음)');
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #8 — 스크러빙 슬라이더
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #8 스크러빙 슬라이더 테스트...');
const rangeInput = page.locator('input[type="range"]').first();
if (await rangeInput.count() > 0) {
  const box = await rangeInput.boundingBox();
  if (box) {
    // 슬라이더를 25% 위치로 드래그
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.waitForTimeout(1500);
    await shot(page, 'scrub-25pct');
    // 슬라이더를 75% 위치로 드래그
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
    await page.waitForTimeout(1500);
    await shot(page, 'scrub-75pct');
    pass(8, '스크러빙 슬라이더 조작 성공 (육안 확인 필요)');
  } else {
    warn(8, '슬라이더 boundingBox 없음');
  }
} else {
  warn(8, '슬라이더 미발견');
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #7 — 초기화
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #7 초기화 테스트...');
const resetBtnNow = page.locator('button').filter({ hasText: /초기화|reset|재설정/i }).first();
if (await resetBtnNow.count() > 0) {
  await resetBtnNow.click();
  await page.waitForTimeout(2000);
  await shot(page, 'reset');
  pass(7, '초기화 동작');
} else {
  warn(7, '초기화 버튼 미발견');
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #9 — 홍수 탭 전환 후 재진입
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #9 홍수 탭 전환 후 쓰나미 탭 재진입...');
const floodTab = page.locator('button, [role="tab"]').filter({ hasText: /홍수|flood/i }).first();
if (await floodTab.count() > 0) {
  await floodTab.click();
  await page.waitForTimeout(2000);
  await shot(page, 'flood-tab');

  // 다시 쓰나미 탭
  const tsunamiTab2 = page.locator('button, [role="tab"]').filter({ hasText: /쓰나미|tsunami/i }).first();
  if (await tsunamiTab2.count() > 0) {
    await tsunamiTab2.click();
    await page.waitForTimeout(2000);
    await shot(page, 'tsunami-reenter');
    pass(9, '탭 전환 후 재진입 성공 (잔여객체는 육안 확인 필요)');
  }
} else {
  warn(9, '홍수 탭 미발견');
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #10 — 서해 프리셋
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #10 서해 프리셋 테스트...');
const westSeaPreset = page.locator('button, option, [role="option"]').filter({ hasText: /서해|황해|west/i }).first();
if (await westSeaPreset.count() > 0) {
  await westSeaPreset.click();
  await page.waitForTimeout(2000);
  await shot(page, 'west-sea-preset');
  pass(10, '서해 프리셋 클릭 성공 (육안 확인 필요)');
} else {
  // select dropdown 확인
  const selects = await page.locator('select').count();
  if (selects > 0) {
    const selectEl = page.locator('select').first();
    const opts = await selectEl.locator('option').allTextContents();
    console.log('  드롭다운 옵션:', opts);
    const westIdx = opts.findIndex(o => /서해|황해|west/i.test(o));
    if (westIdx >= 0) {
      await selectEl.selectOption({ index: westIdx });
      await page.waitForTimeout(2000);
      await shot(page, 'west-sea-preset-select');
      pass(10, `서해 프리셋 선택 (옵션[${westIdx}]): ${opts[westIdx]}`);
    } else {
      warn(10, `서해 프리셋 미발견. 옵션: ${opts.join(', ')}`);
    }
  } else {
    warn(10, '서해 프리셋 버튼/드롭다운 미발견');
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// QA #11 — 지도 클릭으로 진원 이동
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 #11 지도 클릭으로 진원 이동...');
// Cesium canvas 중앙을 클릭 (지도 영역)
const canvas = page.locator('canvas').first();
if (await canvas.count() > 0) {
  const box = await canvas.boundingBox();
  if (box) {
    // 캔버스 중앙에서 약간 우측 클릭
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.45);
    await page.waitForTimeout(2000);
    await shot(page, 'map-click-epicenter');
    pass(11, '지도 클릭 동작 (진원 이동은 육안 확인 필요)');
  }
} else {
  warn(11, 'Cesium canvas 미발견');
}

// ──────────────────────────────────────────────────────────────────────────────
// 콘솔 에러 확인
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n🔷 콘솔 에러 수집...');
const jsErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
if (jsErrors.length === 0) {
  console.log('  ✅ 콘솔 에러 없음');
} else {
  console.log(`  ⚠️  에러 ${jsErrors.length}개:`);
  jsErrors.forEach((e, i) => console.log(`    [${i+1}] ${e.slice(0,200)}`));
}

// ──────────────────────────────────────────────────────────────────────────────
// 최종 스크린샷
// ──────────────────────────────────────────────────────────────────────────────
await shot(page, 'final-state');

// ──────────────────────────────────────────────────────────────────────────────
// 결과 요약
// ──────────────────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('📋 QA 결과 요약');
console.log('═'.repeat(60));
results.forEach(r => console.log(`  ${r.status}  #${r.id}  ${r.note}`));
const fails = results.filter(r => r.status.includes('FAIL'));
const warns = results.filter(r => r.status.includes('WARN'));
console.log(`\n  총계: ${results.length}개 항목  |  FAIL: ${fails.length}  |  WARN: ${warns.length}`);
if (jsErrors.length > 0) {
  console.log(`\n⚠️  JS 콘솔 에러 (${jsErrors.length}개):`);
  jsErrors.forEach(e => console.log(`  - ${e.slice(0,150)}`));
}
console.log('\n📁 스크린샷 저장 위치: ./qa-screenshots/');
console.log('═'.repeat(60));

await browser.close();
