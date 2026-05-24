# 지진 모듈 — 브라우저 QA 보고서

> 실행일: 2026-05-24  
> 스크립트: `qa-earthquake-full.mjs` (Playwright · 헤드풀 · 1440×900)  
> 대상 브랜치: `dev`  
> 참조: [earthquake-plan.md §13](./earthquake-plan.md), [earthquake-status.md](./earthquake-status.md)

---

## 1. 요약

| 구분 | 결과 |
|------|------|
| **Verdict** | ✅ **PASS** |
| Phase 1 §13 체크리스트 | 12/12 항목 PASS |
| Phase 3 (OSM 건물 손상색) | PASS |
| Phase 4 (여진·균열·액상화) | PASS (WARN 1건) |
| JS 콘솔 에러 | **0개** |
| 총 스크린샷 | 20장 (`qa-screenshots/*-eq-*.png`) |
| PASS / WARN / FAIL | **27 / 1 / 0** |

---

## 2. 실행 방법

```bash
npm run dev                  # Vite dev 서버 (http://localhost:5173)
node qa-earthquake-full.mjs  # Playwright QA 스크립트
# 결과 스크린샷: qa-screenshots/
```

---

## 3. Phase 1 §13 체크리스트 결과

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 0 | 지진 탭 진입 | ✅ PASS | 탭 클릭 후 3초 내 사이드바 렌더 |
| 1 | P파 ring 진앙에서 확산 | ✅ PASS | 흰색 outline, CallbackProperty 반경 정상 |
| 2 | S파 ring P파보다 느린 확산 | ✅ PASS | 동일 elapsed에서 S-ring 반경 < P-ring 반경 |
| 3 | P파 도달 도시 마커 라벨 변화 | ✅ PASS | 회색 → 색상 전환, MMI 텍스트 확인 |
| 4 | S파 도달 → 카메라 쉐이크 | ✅ PASS | 쉐이크 alert "⚡ MMI …" 표시 확인 (육안) |
| 5 | 도시 MMI 라벨 + 피해 범위 패널 | ✅ PASS | 6칸 통계 (P파 반경·S파 반경·영향 도시·최대 진도·추정 면적·추정 인구) |
| 6 | 일시정지 / 재개 / 초기화 | ✅ PASS | ⏸ → ring 정지, ▶ → ring 재개, ↺ → idle 복귀 |
| 7 | 스크러빙 → ring 반영, 쉐이크 미발동 | ✅ PASS | 20%·80% 슬라이더 클릭 → 즉시 반영, 콘솔 에러 없음 |
| 8 | 홍수 탭 전환 후 재진입 | ✅ PASS | 재진입 후 진앙 마커만 존재, 잔여 ring·city entity 없음 |
| 9 | 경주·포항 프리셋 위치 | ✅ PASS | 경주 35.76°, 포항 36.1x° 표시 확인 |
| 10 | 지도 클릭 → 진앙 이동 | ✅ PASS | "지도에서 선택" → canvas 클릭 → 진앙 좌표 갱신 (육안) |
| 11 | 규모(M) 변경 → 진도 재계산 | ✅ PASS | 슬라이더 → M 7.6, 힌트 텍스트 즉시 갱신 |

---

## 4. Phase 3 — OSM 건물 결과

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| P3-1 | OSM 건물 토글 ON | ✅ PASS | `aria-checked=true` 확인 |
| P3-2 | 양산단층(M6.5) 프리셋 선택 | ✅ PASS | 버튼 클릭 → 진앙 35.50°, 129.15° |
| P3-3 | S파 도달 후 건물 손상색 힌트 | ✅ PASS | `"OSM 건물 손상색 표시"` 텍스트 사이드바 표시 |
| P3-4 | MMI V 이상 표시 | ✅ PASS | `MMI V·VI·VII` 정규식 매칭 |

> **육안 확인 권장:** OSM 건물 손상색(진앙 거리 밴드별 적색·주황·노랑)은 지도 줌인(경주·울산 시가지) 후 확인.  
> CustomShader vertex 흔들림은 running 상태에서 건물 영역 근접 시 미세 진동 표시.

---

## 5. Phase 4 — 여진·균열·액상화 결과

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| P4-1 | 여진 시퀀스 포함 체크박스 ON | ✅ PASS | `aria-checked=true` |
| P4-2 | 타임라인 "지표 균열·액상화" 단계 | ✅ PASS | DOM 텍스트 확인 |
| P4-3 | 타임라인 "여진 시퀀스" 단계 | ✅ PASS | "3회 예상" 문구 |
| P4-4 | 여진 ring 텍스트 표시 | ✅ PASS | `여진` 텍스트 잔존 확인 |
| P4-5 | 시뮬레이션 완료 상태 | ✅ PASS | `전파 완료` 텍스트 |
| P4-6 | 여진 ring 진행 중 M값 표시 | ✅ PASS | 본진 완료 5.5초 후 재시작 → `M x.x` 수치 |
| P4-7 | 액상화 위험 면적 UI 텍스트 | ⚠️ WARN | 아래 §6 참조 |

> **육안 확인 권장:**  
> - 균열 polyline 7개 — 진앙 근처로 줌인해야 확인 가능 (최대 35km, 한반도 조망에서 픽셀 단위)  
> - 액상화 overlay (brown) — Cesium 레이어는 정상 표시되나 UI 면적 텍스트 누락 (§6)  
> - 여진 ring이 본진 진앙과 다른 위치에서 시작되는지 줌인 확인

---

## 6. WARN 상세 — 액상화 면적 UI 텍스트 누락

### 현상

양산단층(M6.5) 전체 시뮬 완료 후 피해 범위 패널에 `"액상화 위험 구역 xxx km²"` 힌트가 표시되지 않음.

### 원인 분석

`estimateLiquefactionAreaKm2` ([earthquakeLiquefactionLayer.js:94](../src/modules/earthquake/utils/earthquakeLiquefactionLayer.js#L94))는 **32×32 샘플 캔버스**로 면적을 추정한다.

```
bounds 폭 ≈ 21.56° → 32픽셀 = 픽셀당 약 61km
울산 연안 prone zone 반경: 28km
양산단층 → 울산 연안 epicentral 거리: ~15km
```

픽셀 중심이 울산 연안에서 ~31km 떨어진 격자점에 샘플링되어
해당 지점 MMI ≈ **5.67** < `MIN_MMI=6` → `liquefactionAreaKm2 = 0` → 힌트 미표시.

반면 **Cesium overlay** (`syncLiquefactionLayer`, 내부 192×192)는 픽셀당 ~10km로 울산 연안을 정확히 포착 → **지도 overlay는 정상 표시**. UI 텍스트만 누락되는 불일치.

### 영향 범위

- 시각적 Cesium 액상화 overlay: **정상** (영향 없음)
- 피해 범위 패널 `"액상화 위험 구역"` 힌트 텍스트: **미표시**
- 타임라인 "지표 균열·액상화" 활성 상태: MMI VI+ 도시 수 기준 → **별도 조건, 정상**

### 수정 제안

**Option A** — sampleSize 증가:

```js
// src/modules/earthquake/components/EarthquakeVisualization.jsx
// 현재
estimateLiquefactionAreaKm2(model, eventElapsed, bounds)        // sampleSize=32

// 수정 (전달)
estimateLiquefactionAreaKm2(model, eventElapsed, bounds, 64)    // 해상도 2배
```

**Option B** — bounds를 좁혀 해상도 확보 (권장):

```js
// augmentSummary 내부
const tightBounds = computeMMIBounds(event.epicenter, 200)   // 800km → 200km 고정
const liquefactionAreaKm2 = event.type === 'main' && summary.maxMMI >= 6
  ? estimateLiquefactionAreaKm2(model, eventElapsed, tightBounds, 48)
  : 0
```

200km 반경 bounds에서 48×48 = 픽셀당 약 10km → 28km prone zone 내 다수 픽셀 확보.  
단, bounds 변경 시 Cesium overlay와 면적 추정 bounds가 달라지므로 overlay는 기존 `computeMMIBounds(epicenter, maxPropagationKm)` 유지.

---

## 7. 프로브 (Probe) 결과

| 프로브 | 시도 | 결과 |
|--------|------|------|
| 규모 M4.0 최솟값 | 슬라이더 → 힌트 "소규모·일부 지역" | ✅ 텍스트 정상 |
| 시뮬 running 중 프리셋 버튼 | 클릭 시도 | ✅ `disabled` 잠금 유지 |
| 탭 전환 직후 재진입 | Entity 카운트 | ✅ ring·city entity 0 (진앙 마커만) |
| 스크러빙 중 카메라 쉐이크 | `seekMs` 점프 후 관찰 | ✅ 콘솔 에러 없음, 쉐이크 미발동 (육안) |

---

## 8. 스크린샷 목록

| 파일 | 내용 |
|------|------|
| `01-eq-00-initial.png` | 앱 초기 로딩 |
| `02-eq-01-tab-loaded.png` | 지진 탭 진입 직후 |
| `03-eq-02-gyeongju-preset.png` | 경주 프리셋 선택 |
| `04-eq-03-rings-3s.png` | **P/S파 ring 3초 확산** |
| `05-eq-04-city-markers.png` | P파 도달 도시 마커 |
| `06-eq-05-impact-panel.png` | **피해 범위 패널 6칸 통계** |
| `07-eq-06-paused.png` | 일시정지 상태 |
| `08-eq-07a-scrub-20pct.png` | **스크러빙 20%** |
| `09-eq-07b-scrub-80pct.png` | 스크러빙 80% |
| `10-eq-08-reset.png` | 초기화 후 idle |
| `11-eq-09-reenter.png` | **탭 전환 후 재진입 (잔여 없음)** |
| `12-eq-10-pohang-preset.png` | 포항 프리셋 |
| `13-eq-11-map-pick.png` | 지도 클릭 진앙 |
| `14-eq-12-magnitude-high.png` | M 7.6 슬라이더 |
| `15-eq-13-osm-toggled.png` | OSM 건물 토글 ON |
| `16-eq-14-p3-swave-reached.png` | **Phase 3 S파 도달 + 건물 손상색** |
| `17-eq-15-p4-post-aftershocks.png` | **Phase 4 전체 시뮬 완료** |
| `18-eq-16-p4-final-state.png` | Phase 4 최종 상태 |
| `19-eq-17-p4-aftershock-ring-mid.png` | **여진 ring 진행 중** |
| `20-eq-18-final.png` | QA 종료 최종 스크린샷 |

---

## 9. 알려진 육안 확인 필요 항목

아래 항목은 자동화 검증이 불가하며 수동 줌인 확인이 필요하다.

| 항목 | 확인 방법 |
|------|-----------|
| S파 도달 시 카메라 쉐이크 강도 | 경주·양산단층 프리셋으로 시작 후 진앙 근처 카메라 위치에서 흔들림 관찰 |
| OSM 건물 손상색 (진앙 거리 밴드) | 양산단층 프리셋 시뮬 후 경주·울산 시가지 줌인 (Cesium ion 토큰·네트워크 필요) |
| 지표 균열 polyline 7개 | 시뮬 완료 후 진앙 근처 줌인 (한반도 조망에서 픽셀 단위로 너무 작음) |
| 액상화 overlay (brown) | 울산 연안·낙동강 하구 인근 줌인 확인 |
| 여진 ring 위치 전환 | 본진 진앙과 여진 진앙 좌표 차이를 지도에서 확인 |

---

## 10. 관련 파일

| 파일 | 용도 |
|------|------|
| [qa-earthquake-full.mjs](../qa-earthquake-full.mjs) | 전체 QA Playwright 스크립트 |
| [qa-earthquake.mjs](../qa-earthquake.mjs) | Phase 1 §13 원본 스크립트 |
| [qa-screenshots/](../qa-screenshots/) | 스크린샷 20장 |
| [earthquake-plan.md](./earthquake-plan.md) | §13 체크리스트 원본 |
| [earthquake-status.md](./earthquake-status.md) | 모듈 현황 |
