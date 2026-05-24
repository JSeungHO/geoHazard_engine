# 세션 인계 문서

> 작성일: 2026-05-24  
> 목적: 다음 세션에서 현재 맥락 없이 작업을 이어받기 위한 요약

---

## 1. 프로젝트 한줄 요약

**GeoHazard Engine** — 홍수·쓰나미·지진 교육용 재난 시뮬레이션 (Cesium.js + React + Vite).  
배포: [geohazard-engine.vercel.app](https://geohazard-engine.vercel.app) | 브랜치: `dev` (개발) → `main` (배포)

---

## 2. 현재 모듈 상태

| 모듈 | 상태 | 비고 |
|------|------|------|
| 홍수·침수 (`FloodModule`) | ✅ 완성 | WaterWaveEngine + terrain grid 클램핑 |
| 쓰나미 (`TsunamiModule`) | ⏸ 보류 | WebGL 3D 파도 완료 후 통합 예정. 코드는 프로토타입 보존 |
| 지진 (`EarthquakeModule`) | ✅ Phase 1~4 완료 · QA PASS | P/S파·MMI·OSM·여진·균열·액상화 전 기능 동작 확인 |

---

## 3. 이번 세션에서 한 것

### 3.1 버그 수정

**해양 침수 렌더링 버그** (`FloodVisualization.jsx`)

- **증상**: 쓰나미 시작 시 카메라가 400km+ 광역 조망으로 이동하면 `addViewFloodBoundsListener`가 해양 전체를 침수 범위로 계산 → 바다 위에 침수 mesh 생성
- **수정**: `FloodVisualization`에 `fixedBounds = null` prop 추가. 제공 시 카메라 리스너 생략, 해당 범위 고정 사용
- **관련 파일**: `src/modules/flood/components/FloodVisualization.jsx` (수정), `src/modules/tsunami/TsunamiModule.jsx` (fixedBounds 전달)
- **현재 상태**: 수정 완료, 테스트 통과

### 3.2 문서 작성

| 문서 | 내용 |
|------|------|
| `docs/coastal-surge-plan.md` | GeoServer vs 셰이더 방식 비교 기획 |
| `docs/coastal-surge-shader-plan.md` | 셰이더 방식 상세 설계 (5단계 구현 계획) |

### 3.3 문서 갱신

- `docs/goals.md` — 프로젝트 방향 전환 반영 (강남 중심 → 재난별 위치 분리), 쓰나미 Phase 1 완료 상태 갱신
- `docs/features.md` — 테스트 수 26→35개 (7파일) 수정, 쓰나미 모듈 섹션 추가, 파일 구조 갱신
- `docs/README.md` — 새 기획 문서 2개 링크 추가
- `docs/tsunami-phase1.md` — 사용자가 직접 수정 (Phase 2 반영, 방향 전환 이력 정리)

### 3.4 테스트 결과

```
Tests  35 passed (35)  —  7 files
```

---

## 4. 다음에 해야 할 것 (우선순위 순)

### ✅ 완료 — 지진 모듈 (Phase 1~4 + QA, 2026-05-24)

`node qa-earthquake-full.mjs` — **PASS 27 / WARN 1 / FAIL 0**  
상세: [earthquake-qa.md](./earthquake-qa.md)

### 🎯 현재 집중 — 홍수·지진 제품 polish

| 우선 | 항목 |
|------|------|
| 1 | 배포([Vercel](https://geohazard-engine.vercel.app)) 체험·교육용 고지 문구 |
| 2 | 지진 권장 시나리오(경주 M5.8 등)·온보딩 갱신 |
| 3 | 홍수 시각·UX QA, perf-phase3 ([goals.md](./goals.md)) |
| 4 | 지진 WARN — 액상화 면적 텍스트 수정 여부 결정 |

### ⏸ 보류 — 쓰나미 모듈

**착수 조건**: 별도 **WebGL 3D 파도 애니메이션** 프로젝트 완료 → Cesium 통합 가능 시 GeoHazard 적용.

- UI 탭 미노출 유지 (`MODULE_REGISTRY` 미등록)
- `src/modules/tsunami/` — Phase 1 프로토타입 보존 (`TsunamiWaveModel`, UI 패턴)
- 기존 surge 셰이더 기획([coastal-surge-shader-plan.md](./coastal-surge-shader-plan.md))은 **WebGL 미적용 시 대안**으로 보관
- 상세: [tsunami-status.md §2.3](./tsunami-status.md)

~~쓰나미 브라우저 QA·Fabric 셰이더 5단계~~ → WebGL 파도 통합 후 재개

### 🔵 이후

- `locations/` 확장 (강남 / 연안 / 단층대)
- 모바일 반응형 (1000px 차단 해제)
- 쓰나미 탭 재노출 (WebGL 통합 완료 후)

---

## 5. 핵심 파일 지도

```
src/
├── modules/
│   ├── flood/components/FloodVisualization.jsx  ← fixedBounds prop 추가됨 (이번 세션)
│   └── tsunami/
│       ├── TsunamiModule.jsx                    ← 대폭 리팩터 (연안 중심, 카메라 개선)
│       ├── components/TsunamiVisualization.jsx  ← ring + 연안마커 + run-up sync
│       ├── components/TsunamiMainUI.jsx         ← 피해 범위 패널, ScrubBar
│       ├── constants/coastalImpactPoints.js     ← 연안 11곳 + getImpactPointsForEpicenter
│       ├── constants/coastalSurgeLayout.js      ← 해안선 방향 벡터, surgeMask UV 계산
│       ├── constants/tsunamiPresets.js          ← DEFAULT_TSUNAMI_OPTIONS, EPICENTER_PRESETS
│       └── utils/
│           ├── tsunamiRunupSites.js             ← buildSurgeFan (셰이더 Step 2 대상)
│           └── tsunamiRunupPrimitives.js        ← TsunamiRunupPrimitiveLayer (셰이더 Step 3 대상)
├── physics/TsunamiWaveModel.js                 ← 순수 JS 결정론 모델 (35 테스트 통과)
└── utils/floodWaterMaterial.js                 ← 셰이더 Step 1 대상 (TsunamiSurgeMaterial 추가)
```

---

## 6. 알려진 이슈 (미해결)

| # | 증상 | 위치 | 우선순위 |
|---|------|------|----------|
| 1 | wedge 단색 평면 | `tsunamiRunupPrimitives.js` | ⏸ WebGL 파도로 대체 예정 |
| 2 | shorePoint 고정 오프셋 | `coastalImpactPoints.js` | 🟡 WebGL 통합 시 재검토 |
| 3 | GroundPrimitive run-up 가시성 | `tsunamiRunupPrimitives.js` | ⏸ WebGL 파도로 대체 예정 |

---

## 7. 관련 문서 빠른 참조

| 문서 | 용도 |
|------|------|
| [tsunami-status.md](./tsunami-status.md) | **현재 상태** — 구현 현황, 이슈, Git 상태 |
| [tsunami-phase1.md](./tsunami-phase1.md) | 설계 원칙, API, 컴포넌트 구조, 하지 말아야 할 것 |
| [coastal-surge-shader-plan.md](./coastal-surge-shader-plan.md) | flat wedge용 Fabric 셰이더 (**대안·레거시**, WebGL 파도 우선) |
| [coastal-surge-plan.md](./coastal-surge-plan.md) | GeoServer vs 셰이더 방식 선택 근거 |
| [earthquake-qa.md](./earthquake-qa.md) | **지진 QA 결과** — PASS 27/WARN 1/FAIL 0 |
| [earthquake-status.md](./earthquake-status.md) | 지진 모듈 현황 (Phase 1~4 완료) |
| [features.md](./features.md) | 전체 파일 구조, 테스트 현황 |
| [goals.md](./goals.md) | 로드맵, Phase 계획 |

---

## 8. 로컬 실행

```bash
npm install
cp .env.example .env      # VITE_CESIUM_TOKEN 설정
npm run dev               # http://localhost:5173
npx vitest run            # 단위 테스트 (35/35 통과 확인)
npm run build             # 프로덕션 빌드 확인
```

---

## 9. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-24 | 초판 — 세션 인계용 문서 |
| 2026-05-24 | 쓰나미 WebGL 3D 파도 통합 전략 반영, 우선순위 → 홍수·지진 polish |
| 2026-05-24 | 지진 모듈 Phase 4 완료 및 브라우저 QA 통과 반영 |
