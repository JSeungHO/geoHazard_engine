# 작업 목표

프로젝트 방향, 로드맵, 배포, Cesium 재난 표현 범위.

> **2026-05-24 평가 반영**: [기획·테스트 평가](./evaluation.md) §5 권장 로드맵을 아래에 반영함.

## 프로젝트 목표

- 현실적인 재난(홍수, 지진 등) 시뮬레이션 플랫폼 구축
- 강남역 기준 좌표 **(37.4975, 127.0267)** 지형 데이터 활용
- 사용자가 강수량·수위 등 환경 변수를 조절하며 재난 상황을 인터랙티브하게 체험

**원칙**: 정밀 CFD/구조 해석은 외부 계산 → Cesium 시각화. GeoHazard Engine은 **교육·체험용 단순화 모델 + 3D 연출**에 집중.

**제품 목표** (평가 §1): 렌더링 파이프라인 완성도는 높으나, 온보딩·단위 설명·초기화 등 **사용자 경험**을 다음 스프린트에서 보완.

## 완료된 마일스톤

- [x] `WaterLevelControl.jsx`, Entity → Primitive 전환
- [x] `WaterWaveEngine` 2D 파동 + 동적 수면 mesh
- [x] `FloodPhysicsWater` 하늘색 + 태양 glint
- [x] 강수량 → 수면 파문, 강수 → 수위 자동 상승
- [x] 좌/우 사이드바 UI + Cesium canvas 레이아웃
- [x] terrain grid + 저지대 기준 홍수 채움
- [x] 성능 1차 (수면 캐시, rAF 분리, 비동기 지형)
- [x] pitch view bounds (`floodViewBounds.js`)
- [x] Vercel Production + `dev` Preview, `docs/` 문서 분리

## 수정 로드맵 (평가 §5 권장)

### 즉시 — ~1주

| ID | 항목 | 유형 |
|----|------|------|
| B-1 | WaterWaveEngine 경계 셀 흡수 BC | 버그 |
| B-3 | `buildFloodBodyGeometry` Cartesian3 scratch 재사용 | 성능 |
| B-5 | `createRainStreakImage()` 모듈 상수화 | 성능 |
| U-3 | 시뮬레이션 **초기화** 버튼 | UX |
| U-6 | 지형 async 샘플링 **로딩 배지** | UX |

### 단기 — 2~3주

| ID | 항목 | 유형 |
|----|------|------|
| B-2 | **성능 2차** — 수위 변화 임계값 + body buffer 재사용 | 성능 |
| B-6 | 자동 수위 **drainage** (강수 감소 시 하강) | UX/로직 |
| U-1 | Welcome **온보딩** 오버레이 | UX |
| U-2 | 슬라이더 **단위·의미 힌트** (저지대 대비 m, mm/h 환산) | UX |
| A-1 | `modules/flood/`로 홍수 컴포넌트 **디렉토리 정리** | 아키텍처 |
| A-2 | `App.jsx` **모듈 라우터** (쓰나미·지진 대비) | 아키텍처 |

### 중기 — ~1개월

| ID | 항목 | 유형 |
|----|------|------|
| U-4 | 시뮬레이션 옵션 **프리셋** (잔잔/보통/폭풍) | UX |
| U-7 | **프리셋 시나리오** (강남 침수 사례 등) | UX |
| A-4 | Vitest **단위 테스트** (WaterWaveEngine, terrainHeight, floodViewBounds) | 품질 |
| — | **쓰나미 Phase 1** — 진원 + ring 수위 | 모듈 |
| — | **쓰나미 Phase 2** — 방향성 전파, run-up | 모듈 |

### 장기 — 2~3개월

| ID | 항목 | 유형 |
|----|------|------|
| — | **쓰나미 Phase 3a** — 건물 침수 shader | 모듈 |
| — | **지진 Phase 1** — camera shake 단독 (쓰나미 완료 전 선행 가능) | 모듈 |
| — | **쓰나미 Phase 3b** — 타임라인 UI | 모듈 |
| — | **지진 Phase 2** — 건물 흔들림 | 모듈 |
| A-3 | 위치 추상화 — 강남 외 지점 지원 | 아키텍처 |

### 범위 외 (당분간 보류)

- 산불·태풍·산사태 등 — 홍수/쓰나미/지진 3종 **완성도 우선** (평가 §5)
- U-8 모바일 반응형 — 단기: 768px 이하 데스크탑 안내, 장기: 레이아웃 개편

## 다음 재난 모듈

### 쓰나미 (우선)

**Phase 3 분리** (평가 §5): 기존 Phase 3(건물 침수 + shake + 타임라인)은 볼륨 과대 → **3a(건물 침수 shader)** / **3b(타임라인 UI)** 로 분리.

1. **Phase 1** — 진원 + 반경 확장 ring 수위, 저지대 채움 재사용
2. **Phase 2** — 방향성 전파, 해안 run-up
3. **Phase 3a** — OSM 건물 하부 침수 (Classification / shader)
4. **Phase 3b** — camera shake, UI 시나리오 타임라인
5. **Phase 4** (선택) — splash/debris, collapse tileset

### 지진

- **Phase 1** (단독 빠른 구현): camera shake — 쓰나미 4단계 전부 끝날 때까지 기다리지 않아도 됨
- **Phase 2**: 3D Tiles 흔들림/손상 표현

## 배포·브랜치

| 환경 | 브랜치 | URL |
|------|--------|-----|
| Production | `main` | [geohazard-engine.vercel.app](https://geohazard-engine.vercel.app) |
| Preview | `dev` | Vercel Preview URL |

**워크플로**: `dev`에서 개발 → PR/merge → `main` → Production 자동 배포 (Vercel + GitHub)

- **빌드**: `npm run build` — `vite-plugin-cesium`이 `dist/cesium/`에 Workers·WASM 복사
- **환경 변수**: Vercel → `VITE_CESIUM_TOKEN` (Production·Preview). 변경 후 Redeploy

## 로컬 설정

```bash
npm install
cp .env.example .env   # VITE_CESIUM_TOKEN
npm run dev
npm run build && npm run preview   # 프로덕션 확인
```

## Cesium 재난 표현 — 가능 범위

Cesium은 **지구·지형·3D 객체 위 재난 시각화** 엔진. CFD·구조 해석 엔진은 아님.

| 재난 | 주요 수단 | 난이도 | 상태 |
|------|-----------|--------|------|
| 홍수·침수 | Primitive 수면, terrain grid, ParticleSystem | ★★☆ | **구현됨** |
| 폭우 | ParticleSystem | ★☆☆ | 강수 일부 구현 |
| 쓰나미 | 홍수 확장 + wave front + run-up | ★★★ | 설계 |
| 지진 | Camera shake, 3D Tiles 변형/클리핑 | ★★☆ | Roadmap |
| 산불·화산 | ParticleSystem, Polygon extrusion | ★★★ | 범위 외 |
| 태풍·폭풍 해일 | 강수 + storm surge | ★★★ | 범위 외 |

### Cesium 빌딩 블록 (재난 공통)

| API | 용도 |
|-----|------|
| `ParticleSystem` | 비, 연기, splash |
| `Primitive` + 동적 `Geometry` | 침수·쓰나미 수면 |
| `3D Tileset` | OSM 건물 |
| `ImageryLayer` | heatmap, 위험도 |
| `ClippingPlane` / `Classification` | 굴착 단면, 건물 침수 |
| Custom `Material` / PostProcess | 물, 불, 카메라 효과 |
| `CZML` | 시간축 시나리오 |

## 쓰나미 모듈 설계 (예정)

**목표**: 진원에서 발생한 수파가 해안·내륙으로 밀려와 건물을 침수·휩쓸 듯 보이는 시나리오 애니메이션.

**현실적 범위**:

- ✅ 진원 위치·규모(M) UI, 시간축 재생
- ✅ 원형/방향성 wave front (단순 2D 전파)
- ✅ 해안 run-up (terrain grid 기반)
- ✅ OSM 건물 하부 침수
- ✅ camera shake, splash, cinematic flyTo
- ⚠️ 건물 붕괴 — 3D Tiles 부수기 API 없음 → 침수색/클리핑/별도 collapse 모델로 **연출**
- ❌ 영화급 CFD, 건물 파편 물리

**홍수 엔진 재사용**:

| 기존 | 쓰나미 확장 |
|------|-------------|
| `terrainHeight.js` | run-up, 해안 침수 판정 |
| `floodWaterMesh.js` | `waterHeight(x,y,t)` |
| `WaterWaveEngine` | crest 통과 시 국소 파동 |
| `FloodVisualization` | `TsunamiVisualization` + 타임라인 |
| OSM Buildings | Classification / 층별 침수 shader |

**모듈 구조 (안)**:

```
src/modules/tsunami/
  TsunamiModule.jsx
  TsunamiVisualization.jsx
  useTsunamiTimeline.js
src/physics/TsunamiWaveModel.js
```

## 지형(Terrain)과 지하 — 한계

World Terrain = **지표면 DEM 메쉬**. 속이 채워진 3D 지질 모델이 아님.

| 질문 | 가능? | 설명 |
|------|-------|------|
| 지표면 고도 | ✅ | `globe.getHeight`, `sampleTerrainMostDetailed` |
| 저지대 기준 침수 | ✅ | `min(terrain grid) + depth` (현재) |
| 굴착 후 지층 깊이 | ❌ | 지질 데이터 없으면 불가 |
| 시각적 굴착·단면 | ✅ | Clipping Plane — 렌더 절단만 |

## 관련 문서

- [기획·테스트 평가](./evaluation.md) — 이슈 상세, QA 체크리스트
- [구현 기능](./features.md) — 현재 코드·아키텍처
- [디자인 가이드](./design.md) — UX 백로그
