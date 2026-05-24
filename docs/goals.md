# 작업 목표

프로젝트 방향, 로드맵, 배포, Cesium 재난 표현 범위.  
마지막 갱신: 2026-05-24

---

## 프로젝트 목표

- **홍수·쓰나미·지진** 등 복합 재난 시뮬레이션 **교육·체험 플랫폼** 구축
- 재난 유형마다 **적합한 위치**에서 시뮬레이션: 홍수·침수는 강남역, 쓰나미·지진은 동해·연안 지역 등
- 사용자가 재난 진원·강도·발생 위치를 직접 조절하며 인터랙티브하게 체험
- `locations/` 확장으로 **강남역 외 위치** 지원 — 위치는 재난 모듈 성격에 맞게 분리

> **방향 전환 (2026-05-24)**: 초기에는 강남역 중심이었으나, 강남역은 *홍수에 취약한 한 장소*로 자리매김. 쓰나미·지진은 별도 지리적 위치(동해안, 단층대 등)에서 발생하는 시나리오로 발전.

**원칙**: 정밀 CFD/구조 해석은 외부 계산 → Cesium 시각화. GeoHazard Engine은 **단순화 모델 + 3D 연출**에 집중.

---

## 완료된 마일스톤

### 홍수 엔진 (1차 완성)
- [x] Entity → Primitive 전환, `WaterWaveEngine` 2D 파동 + 동적 수면 mesh
- [x] `FloodPhysicsWater` 하늘색 + 태양 glint + Fresnel 반사
- [x] 강수량 → 수면 파문, 강수 → 수위 자동 상승 + drainage
- [x] terrain grid + 저지대 기준 홍수 채움 (16×16 즉시 → 56×56 async)
- [x] pitch view bounds 침수·강수 공통 (`floodViewBounds.js`)
- [x] 성능 1차 — 수면 캐시, rAF 분리, async 지형, body 재생성 **0.05m 임계값** (B-2 부분 완료)

### UX 완성
- [x] `WelcomeOverlay` 온보딩 (localStorage)
- [x] 슬라이더 힌트 — mm/h 환산, 저지대 기준 m
- [x] 초기화 버튼 (1클릭 전체 리셋)
- [x] `TerrainLoadingBadge` 로딩 표시
- [x] 시뮬레이션 프리셋 (잔잔/보통/폭풍)
- [x] 프리셋 시나리오 (소나기/집중호우/2022 강남역/태풍급)
- [x] `MapStatusBar` 침수 pill + 지표 고도 레이블
- [x] `MobileWarning` 1000px 미만 차단

### 아키텍처 완성
- [x] `modules/flood/` 디렉토리 — 홍수 전용 컴포넌트 완전 이동
- [x] `ModuleShell` + `registry.js` — 모듈 탭 라우터
- [x] `SimulationErrorBoundary` — Cesium 오류 격리
- [x] `locations/gangnam.js` — 좌표 단일 소스
- [x] Vitest 단위 테스트 20개 (4파일)
- [x] Vercel Production + Preview 자동 배포

---

## 현재 로드맵

> **집중 (2026-05-24)**: 쓰나미 탭 **미노출** (`MODULE_REGISTRY`에서 제거) — 홍수·침수 모듈 완성도 우선.

### 🎯 진행 중 — 홍수·침수 모듈 완성도

상세: [perf-phase3.md](./perf-phase3.md) · [features.md](./features.md)

| 우선 | 항목 | 기획 |
|------|------|------|
| 1 | 성능 3차 — body 버퍼·rain bounding box·건물 높이 통합 | [perf-phase3.md](./perf-phase3.md) |
| 2 | 시각·UX QA — 침수 mesh, 건물·지형 정합, 카메라 각도 | — |
| 3 | 시나리오·프리셋 다듬기 (2022 강남역 등) | — |

### ✅ 완료 — 성능 2차

상세: [perf-phase2.md](./perf-phase2.md)

| 항목 | 내용 |
|------|------|
| P-1 | positionBuffer 재사용 — Surface Float64Array 할당 제거 |
| P-2 | body 이중 제어 (0.3m + 400ms 게이트) |
| P-3 | FPS 적응형 surface skip (>22ms) |
| P-4 | body 상단 캡 삼각형 제거 (`omitTopCap`) |
| P-5 | 파동 에너지 기반 동적 update interval (2~6프레임) |

### ⏸ 보류 — 쓰나미 모듈 (Phase 1 완료 · Phase 2 미완)

연안 쓰나미 시뮬레이션 (강남 침수 트리거 아님). **UI 탭 비활성** — run-up 시각화 미완.  
상세: [tsunami-phase1.md](./tsunami-phase1.md) · [tsunami-status.md](./tsunami-status.md)

| Phase | 내용 | 예상 난이도 | 상태 |
|-------|------|-------------|------|
| **Phase 1** | 진원 UI + ring, 타임라인, 스크러빙, 진원 중심 카메라 | ★★☆ | ✅ 완료 |
| **Phase 2** | 방향성 전파, 해안 run-up (region surge wedge) | ★★★ | 🟡 부분 완료 |
| **Phase 3a** | OSM 건물 하부 침수 (Classification / shader) | ★★★ | 🔵 이후 |
| **Phase 3b** | camera shake, UI 시나리오 타임라인 | ★★☆ | 🔵 이후 |
| **Phase 4** (선택) | splash/debris, collapse tileset | ★★★ | 🔵 장기 |

**구현 내용 (현재)**:
- `TsunamiWaveModel` — ring·도달·파고 ramp·coastal spread
- `TsunamiVisualization` — ring/shockwave Entity + 연안 마커 + `GroundPrimitive` run-up
- `coastalImpactPoints` — 연안 참조 도시 11곳
- `buildSurgeFan` — region 기반 바다→육지 surge wedge
- `SimTimeline` + `ScrubBar` — traveling / impacting 단계, 과거 시간 스크러빙
- 시작 카메라 — `flyToBoundingSphere`로 진원 화면 중앙

모듈 구조:
```
src/modules/tsunami/
  TsunamiModule.jsx
  components/ TsunamiVisualization.jsx, TsunamiMainUI.jsx
  constants/  tsunamiPresets.js, coastalImpactPoints.js, coastalSurgeLayout.js
  utils/      tsunamiRunupSites.js, tsunamiRunupPrimitives.js
src/physics/  TsunamiWaveModel.js
```

### 📌 이후 — 지진 모듈

상세: [earthquake-plan.md](./earthquake-plan.md)

| Phase | 내용 | 비고 |
|-------|------|------|
| **Phase 1** | 진원 UI + P파·S파 ring + 카메라 쉐이크 + 도시 MMI 마커 | ✅ 완료 (2026-05-24) |
| **Phase 2** | MMI 진도 등진선 overlay + 규모·깊이 슬라이더 + 피해 통계 | |
| **Phase 3** | OSM 건물 흔들림·손상 (3D Tileset shader) | |
| **Phase 4** (선택) | 여진 시퀀스, 지표 균열, 액상화 overlay | 장기 |

### 📌 다음 — 위치 시스템 확장

재난 모듈마다 지리적 특성이 다르므로 `locations/` 디렉토리를 확장:

| 위치 | 용도 | 상태 |
|------|------|------|
| `gangnam.js` | 홍수·침수 (저지대, 지하 공간) | ✅ 완성 |
| `east_sea.js` 또는 `coastal.js` | 쓰나미 진원 프리셋 (동해, 일본해구) | 📌 예정 |
| `fault_zone.js` 등 | 지진 진원 프리셋 (내륙 단층) | 📌 이후 |

### 🔵 장기 — 기타

- 모바일 반응형 레이아웃 (현재 1000px 차단 → 완전 반응형)
- 산불·태풍·산사태 등 — 홍수/쓰나미/지진 3종 완성 후 검토

---

## 재난별 구현 현황

| 재난 | 주요 수단 | 난이도 | 상태 |
|------|-----------|--------|------|
| 홍수·침수 | Primitive 수면, terrain grid, ParticleSystem | ★★☆ | **✅ 완성** |
| 폭우 | ParticleSystem | ★☆☆ | ✅ (홍수 내 포함) |
| 쓰나미 | 홍수 확장 + wave front | ★★★ | **⏸ 보류** (탭 숨김) |
| 지진 | Camera shake, 3D Tiles 변형 | ★★☆ | 📌 이후 |
| 산불·화산 | ParticleSystem, Polygon extrusion | ★★★ | 🔵 장기 |
| 태풍·폭풍 해일 | 강수 + storm surge | ★★★ | 🔵 장기 |

---

## Cesium 재난 표현 — 가능 범위

Cesium은 **지구·지형·3D 객체 위 재난 시각화** 엔진. CFD·구조 해석 엔진이 아님.

| API | 용도 |
|-----|------|
| `ParticleSystem` | 비, 연기, splash |
| `Primitive` + 동적 `Geometry` | 침수·쓰나미 수면 |
| `3D Tileset` (OSM) | 건물 |
| `ImageryLayer` | heatmap, 위험도 |
| `ClippingPlane` / `Classification` | 굴착 단면, 건물 침수 |
| Custom `Material` / PostProcess | 물, 불, 카메라 효과 |
| `CZML` | 시간축 시나리오 |

### Cesium 한계 (지형)

World Terrain = **지표면 DEM 메쉬**. 속이 채워진 3D 지질 모델이 아님.

| 질문 | 가능? |
|------|-------|
| 지표면 고도 | ✅ `globe.getHeight`, `sampleTerrainMostDetailed` |
| 저지대 기준 침수 | ✅ `min(terrain grid) + depth` |
| vertex buffer 직접 업데이트 | ❌ Cesium 공개 API 없음 |
| 굴착 후 지층 깊이 | ❌ 지질 데이터 없으면 불가 |
| 시각적 굴착·단면 | ✅ Clipping Plane — 렌더 절단만 |

---

## 배포·브랜치

| 환경 | 브랜치 | URL |
|------|--------|-----|
| Production | `main` | [geohazard-engine.vercel.app](https://geohazard-engine.vercel.app) |
| Preview | `dev` | Vercel Preview URL |

**워크플로**: `dev` 개발 → PR/merge → `main` → Vercel 자동 배포

```bash
npm install
cp .env.example .env   # VITE_CESIUM_TOKEN 설정
npm run dev
npm run build && npm run preview   # 프로덕션 확인
npx vitest run                     # 단위 테스트
```

---

## 관련 문서

- [구현 기능](./features.md) — 현재 코드·아키텍처 상세
- [성능 2차 기획서](./perf-phase2.md) — P-1~P-5 최적화
- [기획·테스트 평가](./evaluation.md) — 완료 체크리스트
- [디자인 가이드](./design.md) — UI 레이아웃·토큰
