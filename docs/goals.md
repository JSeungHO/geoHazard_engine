# 작업 목표

프로젝트 방향, 로드맵, 배포, Cesium 재난 표현 범위.

## 프로젝트 목표

- 현실적인 재난(홍수, 지진 등) 시뮬레이션 플랫폼 구축
- 강남역 기준 좌표 **(37.4975, 127.0267)** 지형 데이터 활용
- 사용자가 강수량·수위 등 환경 변수를 조절하며 재난 상황을 인터랙티브하게 체험

**원칙**: 정밀 CFD/구조 해석은 외부 계산 → Cesium 시각화. GeoHazard Engine은 **교육·체험용 단순화 모델 + 3D 연출**에 집중.

## 로드맵

### 1. 범람 엔진 고도화

- [x] `WaterLevelControl.jsx`
- [x] Entity → Primitive 전환
- [x] `WaterWaveEngine` 2D 파동 + 동적 수면 mesh
- [x] `FloodPhysicsWater` 하늘색 + 태양 glint
- [x] 강수량 → 수면 파문, 강수 → 수위 자동 상승
- [x] 좌/우 사이드바 UI + Cesium canvas 레이아웃
- [x] terrain grid + 저지대 기준 홍수 채움
- [x] 성능 1차 (수면 캐시, rAF 분리, 비동기 지형)
- [x] pitch view bounds (`floodViewBounds.js`)
- [ ] **성능 2차** — Primitive 재생성 → buffer update 검토

### 2. 모듈화

- 모든 재난 컴포넌트를 `src/modules/` 하위로 구조화 (홍수는 `modules/flood/` 완료)

### 3. 다음 재난 모듈 (우선순위)

- [ ] **쓰나미** — 진원 전파 + 해안 침수 + 건물 하부 침수 연출 (아래 §쓰나미 설계)
- [ ] **지진** — 카메라 쉐이크 + 건물 흔들림/손상 표현

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
| 산불·화산 | ParticleSystem, Polygon extrusion | ★★★ | — |
| 태풍·폭풍 해일 | 강수 + storm surge | ★★★ | — |
| 산사태 | 파티클/경로, 침식 Polygon | ★★★ | — |
| 대기·화학 확산 | heatmap, plume 파티클 | ★★★ | — |

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

**구현 단계**:

1. **Phase 1** — 진원 + 반경 확장 ring 수위, 저지대 채움 재사용
2. **Phase 2** — 방향성 전파, 해안 run-up
3. **Phase 3** — 건물 하부 침수, camera shake, UI 타임라인
4. **Phase 4** (선택) — splash/debris, collapse tileset

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
| 시각적 굴착·단면 | ✅ | Clipping Plane — 렌더 절단만, 지하 데이터 자동 생성 아님 |

## 관련 문서

- [구현 기능](./features.md) — 현재 코드·아키텍처
- [디자인 가이드](./design.md) — UI·컬러
