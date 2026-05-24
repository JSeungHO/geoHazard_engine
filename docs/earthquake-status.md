# 지진 모듈 — 현재 상황 및 진행 현황

> **상태: ✅ Phase 1~4 완료 · 브라우저 QA 통과 (2026-05-24)**  
> 대상: `src/modules/earthquake/` 및 `EarthquakeWaveModel`  
> 관련 문서: [earthquake-plan.md](./earthquake-plan.md), [earthquake-ui.md](./earthquake-ui.md), [earthquake-qa.md](./earthquake-qa.md)

---

## 1. 요약

지진 모듈은 **교육용 지진파 전파 시뮬레이션**으로, 진앙에서 P파·S파 ring이 확산되고 주요 도시의 MMI 진도·피해 통계·OSM 건물 손상색·여진 시퀀스·지표 균열·액상화 overlay를 시각화한다.

| 구분 | 상태 |
|------|------|
| 모듈 등록·UI·시뮬레이션 루프 | ✅ |
| P/S파 ring + 도시 MMI 마커 | ✅ |
| 카메라 쉐이크 + 타임라인·스크러빙 | ✅ |
| MMI 진도 ImageryLayer overlay | ✅ Phase 2 |
| 피해 통계 (추정 면적·인구) | ✅ Phase 2 |
| OSM 건물 손상색 + CustomShader 흔들림 | ✅ Phase 3 |
| 여진 시퀀스 + 균열 + 액상화 overlay | ✅ Phase 4 |
| 단위 테스트 | ✅ 109 passed (13 files) |
| 브라우저 QA | ✅ PASS (27/27 · WARN 1 · 2026-05-24) |

---

## 2. 아키텍처

```
src/
├── physics/
│   ├── EarthquakeWaveModel.js       ← P/S파·MMI·피해 요약
│   └── EarthquakeWaveModel.test.js
└── modules/earthquake/
    ├── EarthquakeModule.jsx           ← simState, aftershockPlan, totalMs
    ├── components/
    │   ├── EarthquakeMainUI.jsx       ← 사이드바 6칸 피해 통계 + 여진 토글
    │   └── EarthquakeVisualization.jsx← ring + MMI + 건물 + Phase 4 효과
    ├── constants/
    │   ├── earthquakePresets.js       ← 5개 진원 프리셋
    │   ├── earthquakeImpactCities.js  ← 12개 도시 + 인구
    │   └── earthquakeAftershocks.js   ← 여진 계획·타임라인 resolve
    └── utils/
        ├── cameraShake.js
        ├── earthquakeMMILayer.js      ← SingleTileImageryProvider overlay
        ├── earthquakeBuildingEffects.js ← Cesium3DTileStyle + CustomShader
        ├── earthquakeCrackLines.js    ← 지표 균열 polyline
        ├── earthquakeLiquefactionLayer.js ← 액상화 ImageryLayer
        └── *.test.js
```

### 2.1 시각 레이어

| 레이어 | 구현 | 설명 |
|--------|------|------|
| 진앙 마커 | Entity point + label | 빨간 점 "진앙" |
| P파 ring | Entity ellipse (흰 outline) | CallbackProperty 반경 |
| S파 ring | Entity ellipse (주황 outline) | CallbackProperty 반경 |
| 도시 마커 | Entity point + MMI label | S파 도달 시 색·라벨 갱신 |
| MMI overlay | ImageryLayer (256² canvas) | S파 도달 영역만, 50 km bucket 갱신 |
| OSM 건물 손상 | Cesium3DTileStyle | 진앙 거리 밴드별 MMI proxy 색 |
| OSM 건물 흔들림 | CustomShader vertex nudge | running + MMI V+ 시, 일시정지/스크러빙 OFF |
| 지표 균열 | Entity polyline ×7 | 본진 MMI VI+ · S파 20 km+ |
| 액상화 overlay | ImageryLayer (brown) | 연안·하구 저지대 + MMI VI+ |
| 여진 마커 | Entity point (주황) | 여진 구간 진앙 표시 |

### 2.2 시뮬레이션 타임라인

```
idle → main (P/S/shaking/liquefaction) → aftershock 1..N → done
```

- `totalMs = mainDurationMs + Σ(여진 구간)` — `getTotalSimulationMs()`
- 본진 종료 후 여진별 ring·MMI·건물 효과가 해당 여진 진앙으로 재중심
- 카메라 쉐이크는 본진 1회만 (`shakeFiredRef`)
- 균열·액상화는 본진 구간에만 표시

### 2.3 카메라

| 시점 | 동작 |
|------|------|
| 탭 진입 (idle) | `flyToIdleView` — 진앙 중심, 한반도 조망 (pitch -58°) |
| 프리셋 변경 (idle) | 해당 진앙으로 flyTo |
| 시뮬 시작 | `flyToEpicenterView` — 전파 ring 전체 (약 1.05× maxPropagation) |
| 초기화 | 기본 진앙(경주) + idle 조망 |

---

## 3. Phase별 완료 내역

### Phase 1 (2026-05-24)

- `EarthquakeWaveModel` — GMPE 간소화, P/S파 반경·도달·MMI
- ring Entity + 도시 마커 + `cameraShake.js`
- 사이드바 UI, 스크러빙, 5개 진원 프리셋, 지도 클릭 진앙

### Phase 2 (2026-05-24)

- `earthquakeMMILayer.js` — S파 도달 영역 MMI 색상 overlay
- 규모·깊이 슬라이더 (Phase 1부터 존재, UI 확정)
- 피해 통계: 추정 면적 `πr²`, 추정 인구 (도시 인구 × MMI 가중치)
- `earthquakeImpactCities.js` — 12개 도시 인구 필드 추가

### Phase 3 (2026-05-24)

- `earthquakeBuildingEffects.js`
  - `buildBuildingDamageStyle()` — OSM `cesium#longitude/latitude` 거리 밴드
  - `CustomShader` — running 중 MMI V+ 건물 vertex 미세 진동
- `SceneLayerController.instancesRef` — tileset 공유
- idle/reset 시 기본 스타일·shader 복원

### Phase 4 (2026-05-24)

- `earthquakeAftershocks.js` — M≥5.0 시 1~3회 여진, `resolveSimulationEvent()`
- `earthquakeCrackLines.js` — 진앙에서 7방향 방사형 균열 (MMI VI+)
- `earthquakeLiquefactionLayer.js` — 8개 참조 저지대 + MMI VI+ brown overlay
- UI: 여진 토글, 타임라인 "지표 균열·액상화" / "여진 시퀀스" 단계
- `impactSummary.liquefactionAreaKm2` — 피해 패널 표시

---

## 4. QA

### 단위 테스트

```bash
npm test
# 109 passed | 2 skipped (111)
```

### 브라우저 QA 스크립트

```bash
npm run dev
node qa-earthquake.mjs
# 스크린샷: qa-screenshots/*-eq-*.png
```

### §13 브라우저 QA — ✅ 완료 (2026-05-24)

```bash
node qa-earthquake-full.mjs   # PASS 27 / WARN 1 / FAIL 0 · 콘솔 에러 0
```

- [x] P/S파 ring 확산·동시 표시
- [x] 도시 MMI 라벨·피해 패널 6칸 통계
- [x] MMI overlay + OSM 건물 손상색 (힌트 텍스트 확인)
- [x] 카메라·건물 쉐이크 (쉐이크 alert 표시 확인)
- [x] 본진 MMI VI+ 시 균열·액상화 단계 타임라인
- [x] 여진 시퀀스 ring 전환 (M6.5 양산단층, 3회 여진 M값 표시)
- [x] 일시정지/재개/초기화/스크러빙
- [x] 탭 전환 후 잔여 객체 없음

상세 결과: [earthquake-qa.md](./earthquake-qa.md)

**WARN 1건** — `estimateLiquefactionAreaKm2` 32×32 샘플 해상도 부족으로  
피해 패널 액상화 면적 텍스트 미출력 (Cesium overlay는 정상). 수정 제안 → [earthquake-qa.md §6](./earthquake-qa.md)

---

## 5. 알려진 제약 (교육용)

| 항목 | 내용 |
|------|------|
| MMI overlay | 256×256 canvas, 50 km bucket — 부드러운 ring보다 계단형 |
| 건물 손상색 | 진앙 거리 proxy — 실제 GMPE per-building 아님 |
| 건물 흔들림 | 지리 필터 없이 로드 타일 전체 vertex nudge (근사) |
| 추정 인구 | 12개 도시 인구 × MMI 가중치 — 전국 인구 아님 |
| OSM 건물 | ion 토큰·네트워크 필요, OFF 시 건물 효과 비활성 |
| 여진 | 규모·위치 휴리스틱 — 실제 aftershock catalog 아님 |
| 액상화 | 8개 참조 저지대 + MMI threshold — 실제 지질 조사 아님 |

---

## 6. 다음 작업

1. ~~**§13 브라우저 QA** 완료~~ ✅ 2026-05-24 완료
2. **⚠️ WARN 수정** — `estimateLiquefactionAreaKm2` sampleSize 또는 bounds 조정 ([earthquake-qa.md §6](./earthquake-qa.md))
3. **육안 확인 권장** — OSM 건물 손상색·균열 polyline·액상화 overlay 줌인 확인
4. `docs/session-handoff.md` 갱신 유지
