# 구현 기능

현재 GeoHazard Engine에 구현된 기능과 기술 아키텍처.  
마지막 갱신: 2026-05-24

---

## 구현 완료 체크리스트

### 렌더링 · 시뮬레이션
- [x] Cesium 3D Viewport (World Terrain, 강남역 카메라 300m)
- [x] `CesiumMapViewer` — viewer 단일 마운트, 조명·대기
- [x] `FloodVisualization` — Primitive 수면 + 2D 파동 물리 + 하늘색 Fresnel 반사
- [x] `WaterWaveEngine` — 2D ripple tank, 경계 셀 흡수 damping (`_dampBoundary`)
- [x] terrain grid 클램핑 + 저지대 기준 홍수 채움 (`terrainHeight.js`, `floodWaterMesh.js`)
- [x] pitch 기준 view bounds — 침수·강수 공통 (`floodViewBounds.js`)
- [x] `RainSystem` — 파티클 강우 + pitch view bounds 연동, 카메라 고도 비례 emitter 고도
- [x] 강수 → 수위 자동 상승 + drainage (`useRainWaterAccumulation`)
- [x] 시뮬레이션 프리셋 (잔잔/보통/폭풍) + 개별 슬라이더 (`WAVE_PRESETS`)
- [x] `SceneLayersPanel` — OSM 건물 토글 (기본 ON)

### UX · UI
- [x] 좌측 사이드바 (`FloodMainUI`) — 강수·수위·자동상승·시뮬 옵션·초기화
- [x] 시나리오 패널 — 소나기/집중호우/2022 강남역/태풍급 1클릭 세팅 (`ScenarioPanel`)
- [x] `WelcomeOverlay` — 첫 방문 온보딩, localStorage 영구 닫기
- [x] 슬라이더 힌트 — 강수 mm/h 환산, 수위 저지대 기준 m (`displayUnits.js`)
- [x] `TerrainLoadingBadge` — 지형 정밀화 중 로딩 표시
- [x] `MapStatusBar` — 경위도·카메라 고도·지표 고도·침수 pill
- [x] `MobileWarning` — 1000px 미만 전체 화면 차단 오버레이
- [x] 강남역 flyTo (`locations/gangnam.js`)
- [x] `TsunamiModule` — 진원 프리셋·지도 클릭·파면 ring·타임라인·스크러빙
- [x] T-1 카메라 flyTo — 시작 조망 / 강남역 도달 클로즈업
- [x] 쓰나미 딥블루 머티리얼 (`createTsunamiSurfaceMaterial`)

### 아키텍처 · 인프라
- [x] `ModuleShell` + `registry.js` — 홍수/지진 탭 라우터 (쓰나미 코드 보존·탭 미노출)
- [x] `SimulationErrorBoundary` — Cesium 렌더링 오류 격리 + 재시도
- [x] `locations/gangnam.js` — 좌표·카메라·bounds 단일 소스
- [x] `FloodVisualization.fixedBounds` — 쓰나미 광역 카메라 시 침수 범위 고정
- [x] Vitest 단위 테스트 35개 (7파일)
- [x] Production 빌드: `vite-plugin-cesium` (Workers/WASM)
- [x] Vercel Production (`main`) + Preview (`dev`) 자동 배포

---

## 파일 구조

```
src/
├── App.jsx                          ← ModuleShell + registry 연결
├── locations/
│   └── gangnam.js                   ← 좌표·카메라·bounds 단일 소스 (홍수 기준)
├── modules/
│   ├── registry.js                  ← 모듈 정의 (flood/tsunami/earthquake)
│   ├── flood/
│   │   ├── FloodModule.jsx
│   │   ├── components/
│   │   │   ├── FloodVisualization.jsx   ← 물리 루프, view bounds / fixedBounds, rAF 수면
│   │   │   ├── RainSystem.jsx
│   │   │   ├── FloodMainUI.jsx
│   │   │   ├── SimulationOptions.jsx
│   │   │   ├── WaterLevelControl.jsx
│   │   │   ├── RainControl.jsx
│   │   │   ├── ScenarioPanel.jsx
│   │   │   ├── WelcomeOverlay.jsx
│   │   │   └── TerrainLoadingBadge.jsx
│   │   ├── hooks/
│   │   │   ├── useMapLayout.js
│   │   │   └── useRainWaterAccumulation.js
│   │   ├── constants/
│   │   │   ├── simulationDefaults.js
│   │   │   ├── simulationDefaults.test.js
│   │   │   └── scenarios.js
│   │   └── utils/
│   │       └── displayUnits.js
│   └── tsunami/
│       ├── TsunamiModule.jsx        ← 상태·카메라·flyTo 조율
│       ├── TsunamiModule.css
│       ├── components/
│       │   ├── TsunamiVisualization.jsx ← Cesium ring 애니메이션 + 진원 클릭 선택
│       │   ├── TsunamiMainUI.jsx        ← 사이드바: 진원·파도 설정·타임라인·스크러빙
│       │   └── TsunamiMainUI.css
│       └── constants/
│           └── tsunamiPresets.js        ← 진원 프리셋, 기본 옵션
├── components/                       ← 공용 컴포넌트만
│   ├── CesiumMapViewer.jsx
│   ├── CollapsibleSection.jsx
│   ├── MapStatusBar.jsx
│   ├── ModuleShell.jsx
│   ├── MobileWarning.jsx
│   ├── SimulationErrorBoundary.jsx
│   ├── SceneLayersPanel.jsx
│   └── SceneLayerController.jsx
├── physics/
│   ├── WaterWaveEngine.js
│   ├── WaterWaveEngine.test.js
│   ├── TsunamiWaveModel.js          ← 순수 JS 파면 모델 (haversine, 도달 시간, 수위)
│   └── TsunamiWaveModel.test.js
├── utils/
│   ├── floodViewBounds.js
│   ├── floodViewBounds.test.js
│   ├── floodWaterMesh.js
│   ├── floodWaterMaterial.js        ← createFloodSurfaceMaterial / createTsunamiSurfaceMaterial
│   ├── terrainHeight.js
│   └── terrainHeight.test.js
├── scene/
│   └── sceneLayerRuntime.js
└── constants/
    └── sceneLayers.js
```

---

## 핵심 기술 제약

| 제약 | 내용 |
|------|------|
| **Viewer 인스턴스** | `CesiumMapViewer`에서 **한 번만** 마운트. UI state 변경 시 viewer **내부** 객체만 수정 (`viewerRef` 경유) |
| **Primitive 재생성** | Cesium 공개 API 상 vertex buffer 직접 업데이트 불가 → Primitive를 교체하는 방식 유지 (성능 2차 기획 참고) |
| **Vite 번들** | `vite-plugin-cesium`으로 정적 에셋 번들. `optimizeDeps.exclude: ['cesium']` **금지** |
| **환경 변수** | 로컬 `.env`, Production `VITE_CESIUM_TOKEN`. `.env.example` 참고 |

---

## View Bounds — 침수·강수 공통 (`floodViewBounds.js`)

침수 mesh와 강수 emitter는 **카메라가 보는 지표 범위**를 공유한다.

| 함수 | 역할 |
|------|------|
| `getViewFloodBounds(viewer)` | pitch 밴드 pick → lon/lat AABB |
| `getFloodBandStartForPitch(pitch)` | pitch → 화면 y 시작 비율 |
| `getRainEmitterPosition(viewer, bounds)` | 밴드 세로 중앙을 지표에 투영 |
| `addViewFloodBoundsListener(viewer, cb, opts?)` | `camera.changed` + `moveEnd` 시 bounds 갱신 |
| `boundsChanged(a, b)` | bounds 변화 감지 (ε = 1e-6°) |
| `getDefaultFloodBounds()` | pick 실패 시 강남역 고정 fallback |

**pitch 기준**:

| pitch (rad) | 화면 샘플 | 효과 |
|-------------|-----------|------|
| ≤ -0.589 (≈ -33.8°) | 0 ~ 100% | 화면 전체 물·비 |
| -0.589 → 0 | 위쪽부터 축소 | 지평선 제외 전경만 |
| 0 (수평) | 하단 1/3 | 최대 crop |

---

## 강수 시스템 (`RainSystem.jsx`)

| 항목 | 값 / 방식 |
|------|-----------|
| API | Cesium `ParticleSystem` + `BoxEmitter` |
| 범위 | `getViewFloodBounds` — 침수와 동일 pitch 밴드 |
| 강도 | `emissionRate` 0 또는 20~500 (`intensity` 0~100%) |
| 파티클 | 세로 streak canvas (모듈 상수 `RAIN_STREAK_IMAGE`), gravity `-280` |
| 고도 | `max(cameraHeight × 1.2, 300m)` — 카메라 고도 비례 동적 계산 |
| BoxEmitter Z | `120 + bandFrac × 320` m |

---

## 범람 시각화 (`FloodVisualization.jsx`)

| 구분 | 방식 | 이유 |
|------|------|------|
| 렌더링 | `Primitive` + 동적 `Geometry` | terrain grid + 파동 |
| 수면 | `WaterWaveEngine` + `createWaterSurfaceCache` | 침수 구역만 mesh |
| 부피 | terrain grid extrusion | 지형~수면, 건조 셀 skip |
| 지형 | 16×16 즉시 → 56×56 async refine | 초기 빠른 렌더 + 정밀화 |
| 침수 기준 | `getFloodBaselineHeight` (grid min) | 슬라이더 = 저지대 대비 깊이 |
| 머티리얼 | `FloodPhysicsWater` (Fabric) | 하늘색 + glint + Fresnel |

### 렌더 루프

```
postUpdate (60fps)
  └── WaterWaveEngine.step()              ← 파동 물리
  └── syncBodyForLevel()                  ← body 재생성 (0.3m + 400ms 게이트)

rAF (동적 interval: 2~6프레임, 파동 에너지 기반)
  └── syncSurfacePrimitive()              ← positionBuffer 재사용, 느린 프레임(>22ms) skip
```

> **성능 2차 (구현 완료)**: P-1~P-5 — [perf-phase2.md](./perf-phase2.md)

### WaterWaveEngine

| 파라미터 (기본값) | 값 | 설명 |
|------|-----|------|
| resolution | 56 | 격자 해상도 |
| stiffness | 0.16 | 파동 전파 속도 |
| timeScale | 0.32 | 시간 배율 |
| damping | 0.994 | 감쇠 |
| maxAmplitude | 4.2 | 최대 파고 (m) |
| `_dampBoundary` | 흡수 BC | 경계 반사 아티팩트 방지 |

### 시뮬레이션 프리셋

| 프리셋 | waveTimeScale | waveMaxAmplitude | 특징 |
|--------|---------------|------------------|------|
| 잔잔 | 0.12 | 1.8 m | 낮은 파동·반사 강조 |
| 보통 | 0.32 | 4.2 m | 기본값 |
| 폭풍 | 0.75 | 8.0 m | 거친 파고 |

---

## 프리셋 시나리오 (`scenarios.js`)

| ID | 라벨 | 강수 | 수위 | 자동상승 |
|----|------|------|------|----------|
| drizzle | 소나기 | 40% | 0 m | ON |
| heavy_rain | 집중호우 | 75% | 3.5 m | ON |
| gangnam_2022 | 2022 강남역 | 85% | 8.5 m | OFF |
| typhoon | 태풍급 | 100% | 15 m | ON |

---

## 모듈 라우터 (`registry.js`)

```js
MODULE_REGISTRY = [
  { id: 'flood',      available: true,  component: FloodModule },
  { id: 'earthquake', available: true, component: EarthquakeModule },
]
// 쓰나미: MODULE_REGISTRY 미등록 (⏸ 보류, src/modules/tsunami/ 코드만 보존)
```

`ModuleShell` 탭 UI가 레지스트리를 렌더링. `available: false` 항목은 비활성 표시.

> **재난별 지리적 위치**: 홍수 = 강남역, 쓰나미 = 동해·일본해구 프리셋, 지진 = 단층대·역사 지진 프리셋 5종 + 지도 클릭.

### 지진 모듈 (`EarthquakeModule`) — Phase 1~3 ✅

상세: [earthquake-status.md](./earthquake-status.md)

- [x] P/S파 ring, 도시 MMI 마커, 카메라 쉐이크, 타임라인·스크러빙
- [x] MMI ImageryLayer overlay (`earthquakeMMILayer.js`)
- [x] 피해 통계 — 추정 면적·인구, 12개 도시 인구 데이터
- [x] OSM 건물 손상색 + CustomShader 흔들림 (`earthquakeBuildingEffects.js`)
- [x] `qa-earthquake.mjs` — Playwright 브라우저 QA 스크립트
- [ ] §13 브라우저 QA 수동 검증

---

## 쓰나미 모듈 (`TsunamiModule.jsx`)

### 구성 요소

| 컴포넌트 | 역할 |
|----------|------|
| `TsunamiModule` | 상태 관리, 카메라 flyTo 조율 |
| `TsunamiVisualization` | Cesium ring 애니메이션 + 클릭 진원 선택 |
| `TsunamiMainUI` | 사이드바 — 진원 프리셋, 파도 설정, 타임라인, 스크러빙 |
| `TsunamiWaveModel` | 순수 JS 물리 모델 (haversine 거리, 도달 시간, 수위) |

### 물리 모델 (`TsunamiWaveModel.js`)

| 메서드 | 반환 | 설명 |
|--------|------|------|
| `getRingRadius(elapsedMs)` | m | 파면 반경 (속도 × 시간) |
| `getArrivalMs(lat, lon)` | ms | 목표 지점 도달 시간 |
| `getWaterLevel(elapsedMs, lat, lon)` | m | 도달 후 선형 상승, maxWaterLevel cap |
| `distanceTo(lat, lon)` | m | haversine 거리 |

### 카메라 T-1 시나리오

| 이벤트 | 동작 |
|--------|------|
| idle → running | 진원·강남 중점 조망 (거리 × 1.6 고도, 최소 400km) |
| traveling → flooding | 강남역 클로즈업 flyTo |

### 스크러빙 (T-2)

- `ScrubBar` 슬라이더 — 도달 시점 마커 포함, 0 ~ totalMs
- `seekMs` prop → `TsunamiVisualization`이 refs 직접 점프 → `requestRender()`
- 모델이 순함수이므로 임의 시점으로 즉시 이동 가능

### `fixedBounds` (렌더링 버그 방지)

쓰나미 시작 시 카메라가 400km+ 광역 조망으로 이동하면 `addViewFloodBoundsListener`가 해양 전체를 침수 범위로 잡는 문제 해결:
- `FloodVisualization`에 `fixedBounds` prop 추가
- 제공 시 camera listener 생략 → 침수 범위를 강남역으로 고정

```jsx
// TsunamiModule.jsx
<FloodVisualization
  fixedBounds={getLocationDefaultFloodBounds(GANGNAM)}
  ...
/>
```

---

## 테스트 현황

| 파일 | 케이스 수 | 커버 내용 |
|------|-----------|-----------|
| `WaterWaveEngine.test.js` | 4 | step, disturbance, boundary damping, rain |
| `simulationDefaults.test.js` | 3 | preset match, findActivePresetId |
| `terrainHeight.test.js` | 6 | baseline, 수면고도, terrainGridChanged |
| `floodViewBounds.test.js` | 7 | pitch band, boundsChanged, 강남 기준 중심 |
| `TsunamiWaveModel.test.js` | 8 | haversine, getRingRadius, getCoastalWaveHeight, getCoastalSpreadFactor, getImpactSummary, getTotalDurationMs |
| `tsunamiRunupSites.test.js` | 5 | buildSurgeFan 꼭짓점·sea edge 고정·동해 방향, buildRunupSites |
| `coastalSurgeLayout.test.js` | 2 | sea anchor 위치, surge mask wet/dry |
| **합계** | **35** | **전부 통과** |

---

## 관련 문서

- [기획·테스트 평가](./evaluation.md)
- [쓰나미 Phase 1 기획서](./tsunami-phase1.md)
- [성능 2차 기획서](./perf-phase2.md)
- [작업 목표](./goals.md)
- [디자인 가이드](./design.md)
