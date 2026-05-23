# 프로젝트명: GeoHazard Engine



## 1. 프로젝트 목표

- 현실적인 재난(홍수, 지진 등) 시뮬레이션 플랫폼 구축.

- 강남역을 기준 좌표(37.4975, 127.0267)로 지형 데이터 활용.

- 사용자가 환경 변수(강수량, 수위 등)를 조절하여 재난 상황을 인터랙티브하게 체험.



## 2. 현재 상태 (기반 구축 완료)

- [x] Cesium 3D Viewport 연동 완료 (World Terrain, 강남역 카메라 300m)

- [x] `CesiumMapViewer` — viewer 단일 마운트, `CameraFlyTo once`, 조명·대기 설정

- [x] RainSystem.jsx — 파티클 강우 + `viewerRef` 패턴

- [x] RainControl.jsx — 강수량 슬라이더

- [x] WaterLevelControl.jsx — 수위 슬라이더

- [x] FloodVisualization.jsx — Primitive + 2D 파동 물리 + 하늘색 수면 반사

- [x] `FloodModule` viewer `useRef` 패턴 (슬라이더 조절 시 뷰어·카메라 유지)

- [x] Vite + Cesium dev 환경 안정화 (`CESIUM_BASE_URL` define)

- [x] `FloodMainUI` — 좌측 사이드바 (기본 제어 + 시뮬레이션 옵션)

- [x] `SceneLayersPanel` — 우측 레이어 패널 (OSM 건물 토글, 확장 가능)

- [x] 강수 → 수위 자동 상승 (`useRainWaterAccumulation`)

- [x] 시뮬레이션 옵션 (파도·반사·상승 속도) — `simulationDefaults.js`

- [x] UI 컬러 테마 (`--color-bg/primary/danger/text`)

- [x] 지형 그리드 클램핑 + 저지대 기준 홍수 채움 (`terrainHeight.js`, `floodWaterMesh.js`)

- [x] OSM 건물 기본 ON (`sceneLayers.js`)

- [x] Vercel Production 배포 + `dev` 브랜치 Preview

- [x] `CollapsibleSection`, `MapStatusBar`, 강남역 flyTo



## 2-1. UI 레이아웃



```
┌──────────────┬────────────────────────────┬─────────────┐
│ FloodMainUI  │      Cesium 지도           │ SceneLayers │
│ (320px)      │  (margin-right: 280px)     │ (280px)     │
└──────────────┴────────────────────────────┴─────────────┘
```



| 영역 | 파일 | 역할 |
|------|------|------|
| 좌측 | `FloodMainUI.jsx` | 강수·수위·자동상승·시뮬 옵션 |
| 중앙 | `FloodModule-map` + `useMapLayout.js` | Cesium viewer, canvas px 리사이즈 |
| 우측 | `SceneLayersPanel.jsx` | 레이어 토글 UI (`body` portal, `fixed right:0`) |

**레이아웃 주의**: Cesium canvas는 viewport 전체로 그려질 수 있음 → `useMapLayout`으로 컨테이너 px 고정 + `viewer.resize()` 필수.



## 2-2. 레이어 시스템 (확장 가능)



| 파일 | 역할 |
|------|------|
| `src/constants/sceneLayers.js` | 레이어 정의 (`SCENE_LAYER_DEFS`) |
| `src/scene/sceneLayerRuntime.js` | 레이어별 load/setVisible/destroy |
| `src/components/SceneLayerController.jsx` | viewerRef + 가시성 → Cesium 객체 |

현재 레이어: **OSM 건물** (`createOsmBuildingsAsync`, Cesium Ion)



## 2-3. UI 컬러 팔레트



| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-bg` | `#0F172A` | 배경 |
| `--color-primary` | `#38BDF8` | 강수·파도·옵션 |
| `--color-danger` | `#F43F5E` | 수위·침수 |
| `--color-text` | `#F1F5F9` | 텍스트 |


- **State Management**: Cesium 뷰어 인스턴스는 반드시 `useRef`로 관리. (`FloodModule.viewerRef` → `RainSystem` / `FloodVisualization`)

- **Rendering**: Cesium 뷰어는 `CesiumMapViewer`에서 단 한 번만 마운트. UI state 변경 시 `useEffect`로 뷰어 **내부** 객체만 수정.

- **Vite 주의**: `optimizeDeps.exclude: ['cesium']` 사용 금지 — mersenne-twister ESM 오류로 화면 blank 발생.



## 3-1. 범람 시각화 아키텍처 (FloodVisualization)



홍수 수위 표현은 **Entity가 아닌 Primitive**로 구현한다.



| 구분 | 선택 | 이유 |

|------|------|------|

| 렌더링 API | `Primitive` + 동적 `Geometry` | terrain grid 정점 + 파동; 저지대 기준 수면 |

| 수면 | `WaterWaveEngine` + `createWaterSurfaceCache` | 평면 수면 + 법선 방향 파동; 침수 구역만 mesh |

| 부피 | terrain grid extrusion body | 지형~수면 사이; 건조 셀 skip |

| 지형 | `sampleTerrainHeightGrid` → `refineTerrainHeightGrid` | 16×16 즉시 → 56×56 async → `sampleTerrainMostDetailed` |

| 침수 기준 | `getFloodBaselineHeight` (grid min) | 슬라이더 = 저지대 대비 깊이(m) |

| 머티리얼 | `FloodPhysicsWater` (Fabric Material) | 하늘색 + glint + 프레넬 반사 |

| 성능 | `requestAnimationFrame` 수면 갱신 | postUpdate는 물리만; 2프레임마다 mesh |

| ~~Entity polygon~~ | 사용하지 않음 | UV·MaterialProperty 한계, 렌더 오류 이력 |



### 관련 파일



| 파일 | 역할 |

|------|------|

| `src/physics/WaterWaveEngine.js` | 2D ripple tank 파동 물리 (56×56 격자) |

| `src/utils/floodWaterMesh.js` | 파동 → Cesium 수면 Geometry / 부피 Primitive |

| `src/utils/floodWaterMaterial.js` | `FloodPhysicsWater` 셰이더 (하늘색·반사) |

| `src/utils/terrainHeight.js` | terrain grid 샘플, 저지대 baseline, async/refine |

| `src/components/FloodVisualization.jsx` | 물리 루프, 카메라 bounds 연동, rAF 수면 |

| `src/components/CesiumMapViewer.jsx` | Viewer 마운트, 카메라·조명 초기화 |



### 동작 방식



1. **수위 > 0**: terrain grid 샘플 → 저지대 baseline + depth → body/surface Primitive

2. **매 프레임 (`postUpdate`)**: `WaterWaveEngine.step`, 수위 변경 시 body/cache 재생성

3. **수면 갱신 (`requestAnimationFrame`)**: cache + 파동 → Primitive (2프레임 간격)

4. **카메라 moveEnd**: view bounds 변경 → grid 재샘플

5. **수위 = 0**: Primitive 제거 (viewer·카메라 유지)



### FloodPhysicsWater 셰이더 (현재)



- **베이스 색**: 하늘색 (`#96D7FA` 계열), 반투명

- **하늘 거울 반사**: Fresnel + `skyMirrorColor`

- **태양 glint 3단계**: broad(넓은 햇빛) + crest(파도) + fine(미세 ripples)

- 외부 텍스처 미사용 (Vite dev image decode 오류 방지)



### WaterWaveEngine 파라미터 (현재)



| 파라미터 | 값 | 설명 |

|---------|-----|------|

| resolution | 56 | 격자 해상도 |

| stiffness | 0.16 | 파동 전파 속도 |

| timeScale | 0.32 | 시뮬레이션 시간 배율 |

| damping | 0.994 | 감쇠 |

| maxAmplitude | 4.2 | 최대 파고 (m) |



## 4. 진행 순서 (Roadmap)



1. **[현재 작업] 범람 엔진 고도화**:

   - [x] `WaterLevelControl.jsx` 추가

   - [x] Entity → Primitive 전환

   - [x] `WaterWaveEngine` 2D 파동 물리 + 동적 수면 mesh

   - [x] `FloodPhysicsWater` 하늘색 + 태양 반사 glint

   - [x] 강수량 → 수면 파문 연동

   - [x] 강수 → 수위 자동 상승 + 옵션 패널

   - [x] 좌/우 사이드바 UI + Cesium canvas 레이아웃

   - [x] 수위 시뮬레이션 정밀도·범위 튜닝, 지형 클램핑 (terrain grid + 저지대 기준 홍수 채움)

   - [x] 성능 최적화 1차 (수면 캐시, rAF 분리, 비동기 지형 샘플링)

   - [ ] 성능 최적화 2차 (매 프레임 Primitive 재생성 → buffer update 검토)

2. **모듈화 정리**:

   - 모든 재난 컴포넌트를 `src/modules/` 하위로 구조화

3. **다음 재난 모듈** (우선순위):

   - [ ] **쓰나미(Tsunami)** — 진원 전파 + 해안 침수 + 건물 하부 침수 연출 (→ §5-2)

   - [ ] **지진(Earthquake)** — 카메라 쉐이크 + 건물 흔들림/손상 표현

4. **배포·브랜치**:

   - Production: `main` → [geohazard-engine.vercel.app](https://geohazard-engine.vercel.app) (Vercel + GitHub 연동)

   - 개발: `dev` 브랜치 → Vercel Preview

   - 빌드: `vite-plugin-cesium` (Cesium 정적 에셋 포함)

   - 환경 변수: `VITE_CESIUM_TOKEN` (Vercel Environment Variables)



## 5. Cesium 재난 표현 — 가능 범위와 한계



Cesium은 **지구·지형·3D 객체 위에 재난 상황을 시각화**하는 엔진이다. CFD·구조 해석 같은 **정밀 물리 엔진은 아니며**, 계산 결과 또는 단순화 모델을 **3D로 보여주는 플랫폼**으로 이해한다.



### 5-1. Cesium으로 표현 가능한 재난 (난이도)



| 재난 | 주요 Cesium 수단 | 난이도 | 비고 |

|------|------------------|--------|------|

| 홍수·침수 | Primitive 수면, terrain grid, ParticleSystem(비) | ★★☆ | **현재 구현** |

| 쓰나미 | 홍수 확장 + 시간 전파 wave front + run-up | ★★★ | §5-2 설계 |

| 폭우·눈·안개 | ParticleSystem | ★☆☆ | 강수 일부 구현 |

| 지진 | Camera shake, 3D Tiles 변형/클리핑, CZML | ★★☆ | Roadmap |

| 산불·화산 | ParticleSystem(연기/재), Polygon extrusion | ★★★ | — |

| 태풍·폭풍 해일 | 강수 + 바람 벡터 + storm surge 수위 | ★★★ | — |

| 산사태 | 경사면 파티클/경로, 침식 Polygon | ★★★ | — |

| 대기·화학 확산 | heatmap imagery, plume 파티클/격자 | ★★★ | — |



### 5-2. 쓰나미 모듈 설계 (예정)



**목표**: 특정 진원에서 발생한 거대 수파가 해안·내륙으로 밀려와 건물을 **침수·휩쓸 듯** 보이게 하는 시나리오 애니메이션.



**현실적 범위**:

- ✅ 진원 위치·규모(M) UI, 시간축 재생

- ✅ 원형/방향성 **wave front** 전파 (단순 2D 전파 모델)

- ✅ 해안 **run-up** (경사 + terrain grid 기반 수위 상승)

- ✅ OSM 건물 **하부 침수** (수위 vs 건물 바닥 높이)

- ✅ camera shake, splash 파티클, cinematic flyTo

- ⚠️ 건물 **물리 붕괴** — 3D Tiles는 부수기 API 없음 → 침수색/클리핑/별도 collapse 모델로 **연출**

- ❌ 영화급 CFD 유체, 건물 파편 물리 — Cesium 밖 또는 수작업 에셋



**기존 홍수 엔진 재사용**:



| 기존 | 쓰나미 확장 |

|------|-------------|

| `terrainHeight.js` (grid, min baseline) | run-up, 해안 침수 판정 |

| `floodWaterMesh.js` (수면 Primitive) | `waterHeight(x,y,t)` 시간 함수 |

| `WaterWaveEngine` | crest 통과 시 국소 파동 |

| `FloodVisualization` | `TsunamiVisualization` — 타임라인 postUpdate |

| OSM Buildings layer | Classification / 층별 침수 shader |



**구현 단계 (제안)**:



1. **Phase 1** — 진원 + 반경 확장 ring 수위 (`t`에 따라 `waterSurface` 상승), 기존 저지대 채움 재사용

2. **Phase 2** — 방향성 전파, 해안선 run-up 보정

3. **Phase 3** — 건물 하부 침수, camera shake, UI 시나리오 타임라인

4. **Phase 4** (선택) — splash/debris 파티클, 특정 건물 collapse tileset



**모듈 구조 (안)**:



```
src/modules/tsunami/
  TsunamiModule.jsx
  TsunamiVisualization.jsx
  useTsunamiTimeline.js
src/physics/TsunamiWaveModel.js   # distance/time → wave height
```



### 5-3. 지형(Terrain)과 지하 — Cesium이 아는 것 / 모르는 것



**Terrain이란**: World Terrain = **지표면 DEM 메쉬**(표면 껍데기). 속이 채워진 3D 지질 모델이 **아님**.



| 질문 | 가능? | 설명 |

|------|-------|------|

| 이 좌표 **지표면 고도**는? | ✅ | `globe.getHeight`, `sampleTerrainMostDetailed` |

| **저지대 기준** 침수 깊이? | ✅ | `min(terrain grid) + depth` (현재 방식) |

| 땅을 **파서** 지층 깊이를 안다? | ❌ | 지질·시추 데이터 없으면 불가 |

| **시각적으로** 굴착·단면? | ✅ | Clipping Plane — **표면 메쉬를 잘라 안 보이게** 할 뿐, 지하 데이터 자동 생성 아님 |



**Clipping vs 실제 굴착**: terrain 타일을 수정하는 게 아니라 **렌더링 절단**. 단면 아래는 빈 공간이거나 **별도로 넣은** 지질/BIM 모델.



### 5-4. Cesium 빌딩 블록 (재난 공통)



| API | 용도 |

|-----|------|

| `ParticleSystem` | 비, 연기, 재, splash |

| `Primitive` + 동적 `Geometry` | 침수·쓰나미 수면 |

| `3D Tileset` | OSM 건물, 포인트클라우드 |

| `ImageryLayer` | heatmap, 위험도 지도 |

| `ClippingPlane` / `Classification` | 굴착 단면, 건물 침수 |

| Custom `Material` / PostProcess | 물, 불, 카메라 효과 |

| `CZML` | 시간축 시나리오 |



**원칙**: 정밀 물리는 **외부 계산 → Cesium 시각화**. GeoHazard Engine은 **교육·체험용 단순화 모델 + 3D 연출**에 집중.


