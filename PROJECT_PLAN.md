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

- [x] Cesium canvas 레이아웃 (`useMapLayout`, `ResizeObserver`)



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

| 렌더링 API | `Primitive` + 동적 `Geometry` | 파동 물리 결과를 매 프레임 mesh에 반영 |

| 수면 | `WaterWaveEngine` → `buildWaterSurfaceGeometry` | 정점 높이 = 수위 + 파동 변위 |

| 부피 | `PolygonGeometry` extruded body | 수면 아래 반투명 하늘색 부피 |

| 머티리얼 | `FloodPhysicsWater` (Fabric Material) | 하늘색 + 3단계 태양 glint + 프레넬 하늘 반사 |

| ~~Entity polygon~~ | 사용하지 않음 | UV·MaterialProperty 한계, 렌더 오류 이력 |



### 관련 파일



| 파일 | 역할 |

|------|------|

| `src/physics/WaterWaveEngine.js` | 2D ripple tank 파동 물리 (56×56 격자) |

| `src/utils/floodWaterMesh.js` | 파동 → Cesium 수면 Geometry / 부피 Primitive |

| `src/utils/floodWaterMaterial.js` | `FloodPhysicsWater` 셰이더 (하늘색·반사) |

| `src/components/FloodVisualization.jsx` | `postUpdate` 물리 루프, `rainIntensity` 연동 |

| `src/components/CesiumMapViewer.jsx` | Viewer 마운트, 카메라·조명 초기화 |



### 동작 방식



1. **수위 > 0**: `WaterWaveEngine` 시작, 부피 Primitive + 동적 수면 Primitive 생성

2. **매 프레임 (`postUpdate`)**:

   - 파동 1스텝 (`step`) — `timeScale 0.32`, 감쇠·stiffness 튜닝

   - 수위 변경 → `addDisturbance` 충격

   - 강수량 > 0 → `addRainImpacts` (5프레임마다)

   - 수면 mesh 재생성 (정점 normal → glint)

3. **수위 = 0**: 시뮬레이션 중지, Primitive 제거 (뷰어·카메라 유지)



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

   - [ ] 수위 시뮬레이션 정밀도·범위 튜닝, 지형 클램핑 개선

   - [ ] 성능 최적화 (매 프레임 mesh 재생성 → buffer update 검토)

2. **모듈화 정리**:

   - 모든 재난 컴포넌트를 `src/modules/` 하위로 구조화

3. **다음 재난 모듈**:

   - 지진(Earthquake) 파동 효과 추가


