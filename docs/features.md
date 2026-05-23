# 구현 기능

현재 GeoHazard Engine에 구현된 기능과 기술 아키텍처.

## 구현 완료 체크리스트

- [x] Cesium 3D Viewport (World Terrain, 강남역 카메라 300m)
- [x] `CesiumMapViewer` — viewer 단일 마운트, `CameraFlyTo once`, 조명·대기
- [x] `FloodModule` viewer `useRef` 패턴 (슬라이더 조절 시 뷰어·카메라 유지)
- [x] `RainSystem.jsx` — 파티클 강우 + view bounds 연동
- [x] `RainControl.jsx` / `WaterLevelControl.jsx` — 강수·수위 슬라이더
- [x] `FloodVisualization.jsx` — Primitive + 2D 파동 물리 + 하늘색 수면 반사
- [x] pitch 기준 view bounds — 침수·강수 공통 (`floodViewBounds.js`)
- [x] 지형 그리드 클램핑 + 저지대 기준 홍수 채움 (`terrainHeight.js`, `floodWaterMesh.js`)
- [x] 강수 → 수위 자동 상승 (`useRainWaterAccumulation`)
- [x] 시뮬레이션 옵션 (파도·반사·상승 속도) — `simulationDefaults.js`
- [x] `SceneLayersPanel` — OSM 건물 토글 (기본 ON)
- [x] `CollapsibleSection`, `MapStatusBar`, 강남역 flyTo
- [x] Production 빌드: `vite-plugin-cesium` (Workers/WASM)
- [x] Vercel Production + `dev` Preview 배포

## 알려진 이슈 (잔여)

> [evaluation.md](./evaluation.md) — B-2 buffer 직접 업데이트, A-1~A-4, U-4~U-8 등 미구현 항목

## 알려진 이슈 및 기술 부채

> 상세: [기획·테스트 평가](./evaluation.md) §2~§4

### 버그 / 성능 (요약)

| 우선 | ID | 요약 |
|------|-----|------|
| 🔴 HIGH | B-1 | ~~WaterWaveEngine 경계 셀~~ → **수정됨** (흡수 damping) |
| 🔴 HIGH | B-2 | body 재생성 — **0.05m 잔여** (buffer update는 미구현) |
| 🔴 HIGH | B-3 | ~~매 버텍스 new Cartesian3~~ → **수정됨** |
| 🟡 MED | B-4 | ~~강수 emitter 600m 고정~~ → **카메라 고도 비례** |
| 🟡 MED | B-5 | ~~마운트마다 캔버스~~ → **상수화** |
| 🟡 MED | B-6 | ~~drainage 없음~~ → **auto-rise drainage 추가** |
| 🟡 MED | B-7 | ~~Error Boundary 없음~~ → **SimulationErrorBoundary** |
| 🟢 LOW | B-8 | ~~O(n) 전체 비교~~ → **min/max fast-path** |

### 아키텍처 개선 (요약)

| ID | 요약 |
|----|------|
| A-1 | `FloodVisualization` 등 홍수 전용 코드가 `components/`에 분산 → `modules/flood/`로 통합 |
| A-2 | `App.jsx` 단일 `<FloodModule />` — 모듈 라우터 필요 |
| A-3 | 강남 좌표가 4곳 이상 분산 → `locations/gangnam.js` 통합 |
| A-4 | 단위 테스트 없음 — Vitest + 순수 함수 3종 최소 커버 |

### QA 체크리스트

릴리스 전 확인 항목: [evaluation.md §7](./evaluation.md#7-테스터-체크리스트-다음-릴리스-전-확인-항목)

## 핵심 기술 제약

- **State**: Cesium viewer는 `useRef`로 관리 (`FloodModule.viewerRef` → `RainSystem` / `FloodVisualization`)
- **Rendering**: `CesiumMapViewer`에서 viewer **한 번만** 마운트. UI state 변경 시 viewer **내부** 객체만 수정
- **Vite**: `vite-plugin-cesium`으로 정적 에셋 번들. `optimizeDeps.exclude: ['cesium']` **금지** (mersenne-twister ESM → blank)
- **환경 변수**: 로컬 `.env`, Production `VITE_CESIUM_TOKEN`. `.env.example` 참고

## View Bounds — 침수·강수 공통 (`floodViewBounds.js`)

침수 mesh와 강수 emitter는 **카메라가 보는 지표 범위**를 공유한다. `computeViewRectangle` 대신 **화면 세로 밴드 ray pick**으로 bounds 생성.

### pitch → 화면 밴드

Cesium `camera.pitch`(rad): **0 = 수평**, **음수 = 아래를 봄** (강남 기본 -45° ≈ -0.785).

| pitch (rad) | 대략 | 화면 샘플 (세로) | 효과 |
|-------------|------|------------------|------|
| **≤ -0.589** | ~-33.8° 이하 | **0 ~ 100%** | oblique·하향 — 화면 전체 물·비 |
| **-0.589 → 0** | 수평에 가까움 | **위쪽부터 축소** | 지평선 제외, 전경만 |
| **0** | 수평 | **하단 1/3** | 최대 crop |

**상수**: `FLOOD_PITCH_FULL_SCREEN = -0.5894654192726403`

### API

| 함수 | 역할 |
|------|------|
| `getViewFloodBounds(viewer)` | pitch 밴드 pick → lon/lat AABB |
| `getFloodBandStartForPitch(pitch)` | pitch → 화면 y 시작 비율 (0=위, 1=아래) |
| `getRainEmitterPosition(viewer, bounds)` | 밴드 세로 중앙을 지표에 투영 |
| `addViewFloodBoundsListener(viewer, cb, opts?)` | `camera.changed` + `moveEnd` 시 bounds 갱신 |
| `boundsChanged(a, b)` | bounds 변화 감지 (ε = 1e-6°) |

### 소비처

| 컴포넌트 | bounds 사용 | 갱신 |
|----------|-------------|------|
| `FloodVisualization.jsx` | terrain grid·mesh 범위 | listener, debounce 200ms |
| `RainSystem.jsx` | `BoxEmitter` 크기·위치 | listener, 즉시 |

### 동작 흐름

```
camera.pitch
    → getFloodBandStartForPitch
    → 화면 [yStart, 1] 구간 corner/mid ray pick
    → getViewFloodBounds (lon/lat AABB)
    → FloodVisualization: mesh 재생성
    → RainSystem: emitter modelMatrix / BoxEmitter 갱신
```

pick 실패 시 `getDefaultFloodBounds()`(강남역 고정) fallback.

## 강수 시스템 (`RainSystem.jsx`)

| 항목 | 값 / 방식 |
|------|-----------|
| API | Cesium `ParticleSystem` + `BoxEmitter` |
| 범위 | `getViewFloodBounds` — 침수와 동일 pitch 밴드 |
| 강도 | `emissionRate`: 0 또는 20~500 (`intensity` 0~100%) |
| 파티클 | 세로 streak canvas, gravity `-280` |
| 고도 | `max(cameraHeight × 1.2, 300m)` — 카메라 고도 비례 |
| BoxEmitter Z | `120 + bandFrac × 320` m |
| viewer | `viewerRef` — FloodModule과 동일 인스턴스 |

## 범람 시각화 (`FloodVisualization`)

홍수 수위는 **Entity가 아닌 Primitive**로 구현.

| 구분 | 선택 | 이유 |
|------|------|------|
| 렌더링 | `Primitive` + 동적 `Geometry` | terrain grid + 파동, 저지대 기준 수면 |
| 수면 | `WaterWaveEngine` + `createWaterSurfaceCache` | 침수 구역만 mesh |
| 부피 | terrain grid extrusion | 지형~수면, 건조 셀 skip |
| 지형 | `sampleTerrainHeightGrid` → `refineTerrainHeightGrid` | 16×16 즉시 → 56×56 async |
| 침수 기준 | `getFloodBaselineHeight` (grid min) | 슬라이더 = 저지대 대비 깊이(m) |
| 머티리얼 | `FloodPhysicsWater` (Fabric) | 하늘색 + glint + Fresnel |
| 성능 | rAF 수면 갱신 | postUpdate는 물리만; 2프레임마다 mesh |

### 동작 순서

1. **수위 > 0**: terrain grid → baseline + depth → body/surface Primitive
2. **`postUpdate`**: `WaterWaveEngine.step`, 수위 변경 시 body/cache 재생성
3. **rAF**: cache + 파동 → Primitive (2프레임 간격)
4. **view bounds 변경**: pitch·카메라 이동 → grid·mesh 재샘플 (debounce 200ms)
5. **수위 = 0**: Primitive 제거 (viewer·카메라 유지)

### FloodPhysicsWater 셰이더

- 베이스: 하늘색 `#96D7FA` 계열, 반투명
- 하늘 거울 반사: Fresnel + `skyMirrorColor`
- 태양 glint: broad + crest + fine ripples
- 외부 텍스처 미사용 (Vite dev image decode 오류 방지)

### WaterWaveEngine 파라미터

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| resolution | 56 | 격자 해상도 |
| stiffness | 0.16 | 파동 전파 속도 |
| timeScale | 0.32 | 시간 배율 |
| damping | 0.994 | 감쇠 |
| maxAmplitude | 4.2 | 최대 파고 (m) |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/modules/flood/FloodModule.jsx` | viewerRef, 레이아웃 |
| `src/components/CesiumMapViewer.jsx` | Viewer 마운트, 카메라·조명 |
| `src/components/FloodVisualization.jsx` | 물리 루프, view bounds, rAF 수면 |
| `src/components/RainSystem.jsx` | 강수 ParticleSystem |
| `src/physics/WaterWaveEngine.js` | 2D ripple tank |
| `src/utils/floodWaterMesh.js` | 수면 Geometry / 부피 Primitive |
| `src/utils/floodWaterMaterial.js` | `FloodPhysicsWater` 셰이더 |
| `src/utils/terrainHeight.js` | terrain grid, 저지대 baseline |
| `src/utils/floodViewBounds.js` | pitch view band, bounds listener |

## 관련 문서

- [기획·테스트 평가](./evaluation.md) — 버그·아키텍처 상세, QA 체크리스트
- [디자인 가이드](./design.md) — UX 백로그
- [작업 목표](./goals.md) — 수정 로드맵·우선순위
