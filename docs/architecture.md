# 아키텍처

코드 구조, 데이터 흐름, Cesium 사용 시 지켜야 할 제약을 정리한 문서입니다.
모델 식과 근거는 [model.md](./model.md), UI 규칙은 [design.md](./design.md)를 참고하세요.

마지막 갱신: 2026-11-06

---

## 1. 구조

```
src/
├── App.jsx                      모듈 선택 상태 → ModuleShell
├── components/                  모듈 공통 컴포넌트
│   ├── ModuleShell.jsx          앱 바(브랜드·모듈 탭·모델 고지)
│   ├── CesiumMapViewer.jsx      Cesium Viewer (모듈당 1회 마운트)
│   ├── SceneLayerController.jsx 레이어 가시성 → Cesium 객체 로드/표시
│   ├── SceneLayersPanel.jsx     지도 위 레이어 컨트롤
│   ├── MapStatusBar.jsx         커서 좌표·고도·모듈 상태
│   ├── SimulationErrorBoundary  시뮬레이션 레이어 오류 격리
│   └── ui/                      Panel · Field · Slider · SwitchRow
├── modules/
│   ├── registry.js              모듈 목록 (id, label, icon, component)
│   ├── flood/                   도시 침수
│   ├── earthquake/              지진동
│   └── tsunami/                 보류 — registry 미등록
├── physics/                     렌더링과 무관한 순수 계산 (단위 테스트 대상)
│   ├── UrbanPondingModel.js     강우–배수 저류 모델
│   ├── EarthquakeWaveModel.js   지진파 전파·진도
│   ├── WaterWaveEngine.js       수면 2D 파동 (시각 효과)
│   ├── TsunamiWaveModel.js      보류
│   └── validation/              관측 자료 대비 검증
├── utils/                       침수 수면 메시·지형 샘플링·화면 범위
├── scene/sceneLayerRuntime.js   레이어별 load / setVisible / destroy
├── constants/sceneLayers.js     레이어 정의
└── locations/gangnam.js         강남역 기준 좌표·카메라

scripts/
├── shp-to-geojson.mjs           침수흔적도 Shapefile → WGS84 GeoJSON (+ lib/)
├── copy-flood-trace-to-public.mjs
└── qa/                          Playwright 브라우저 QA (lib.mjs 공통 설정)
```

**경계 규칙**
- `physics/`는 Cesium·React를 import하지 않습니다. 입력과 출력이 숫자인 순수 함수·클래스로 두어 Vitest로 검증합니다.
- 모듈(`modules/*`)끼리는 서로 import하지 않습니다. 공통이 필요하면 `components/`나 `utils/`로 올립니다. 예외로 `earthquake`가 `flood/hooks/useMapLayout`을 쓰고 있으며, 정리 대상입니다.
- 새 재난 모듈은 `modules/<id>/`를 만들고 `registry.js`에 한 줄을 추가합니다.

---

## 2. 모듈 구성 패턴

각 모듈은 같은 형태를 따릅니다.

```
<Module>Module.jsx         상태 소유 · 핸들러 · 레이아웃
 ├── <Module>MainUI.jsx    좌측 Panel (상태 표시·입력만, Cesium 접근 없음)
 └── 지도 컨테이너
      ├── CesiumMapViewer
      ├── SimulationErrorBoundary
      │    ├── SceneLayerController
      │    └── <Module>Visualization.jsx   viewerRef로 Cesium 객체 생성·갱신 (렌더 결과 null)
      ├── SceneLayersPanel · 범례 등 오버레이
      └── MapStatusBar
```

- **상태는 Module이 소유**합니다. UI는 props로 받고 콜백으로 바꿉니다.
- **Visualization은 DOM을 그리지 않고** `viewerRef.current`의 엔티티·프리미티브만 다룹니다.
- 매 프레임 루프(rAF, `scene.postUpdate`)에서 읽는 값은 ref에 복사해 두고 읽습니다. 의존성 배열에서 의도적으로 뺀 곳에는 이유를 주석으로 남깁니다.

---

## 3. 데이터 흐름

### 3.1 도시 침수

```
강우 강도 (mm/h) ─┬─► useRainWaterAccumulation ─► UrbanPondingModel.stepPondingDepth ─► 침수 깊이 (m)
                  │        (실제 경과 시간 × 60 배속으로 적분)
                  └─► rainfallToVisualPercent ─► RainSystem (파티클) · 수면 파문

침수 깊이 ─► FloodVisualization
              ├── terrainHeight: 화면 범위 지형 격자 샘플링 (16×16 즉시 → 56×56 정밀화)
              ├── 기준 높이 = 격자 최저점, 수면 = 기준 + 침수 깊이
              ├── floodWaterMesh: 잠기는 셀만 수면·부피 Primitive 생성
              └── WaterWaveEngine: 수면 출렁임 (시각 효과, 수위 계산과 무관)

2022 시나리오 ─► FloodTraceOverlay ─► public/data/seoul-flood-2022-gangnam.geojson
```

침수·강수 범위는 카메라가 보는 지표 범위(`utils/floodViewBounds.js`)를 공유합니다. 카메라 pitch가 수평에 가까울수록 지평선 쪽을 잘라 냅니다.

### 3.2 지진동

```
진원·규모·깊이 ─► EarthquakeWaveModel ─┬─► P/S파 반경 (경과 시간 × 50 배속)
                                      ├─► 도시별 도달 시각·진도 ─► 패널 표, 지도 마커
                                      └─► 진도 래스터 ─► earthquakeMMILayer
buildAftershockPlan ─► resolveSimulationEvent(경과 시간) ─► 본진 / 여진 n / 완료
```

- 한 타임라인 위에 본진과 여진을 순서대로 배치합니다. 스크럽하면 그 시점의 이벤트를 다시 계산합니다.
- 패널의 피해 추정은 여진 구간에도 **본진 전파 완료 시점의 결과**를 유지합니다.

---

## 4. Cesium 제약

| 제약 | 내용 |
|------|------|
| Viewer는 1회 마운트 | `CesiumMapViewer`는 `memo`로 감싸고, UI 상태가 바뀌어도 Viewer를 다시 만들지 않습니다. 변경은 `viewerRef`를 통해 내부 객체에만 적용합니다. |
| 캔버스 크기 | Cesium 캔버스가 viewport 전체로 커지는 문제가 있어 `useMapLayout`으로 컨테이너를 px로 고정하고 `viewer.resize()`를 호출합니다. |
| 오버레이 | 지도 위 UI는 지도 컨테이너 안에 `position: absolute`로 둡니다(포털 미사용). |
| Primitive 갱신 | 공개 API로 vertex buffer를 부분 갱신할 수 없어 Primitive를 교체합니다. 수면은 position buffer를 재사용하고 느린 프레임은 건너뜁니다. |
| 번들 | `vite-plugin-cesium`이 Workers·에셋을 번들합니다. `optimizeDeps.exclude: ['cesium']`을 쓰면 안 됩니다. |
| 토큰 | 지형·OSM 건물은 Cesium Ion 토큰(`VITE_CESIUM_TOKEN`)이 필요합니다. 없으면 지구본만 표시됩니다. |

---

## 5. 품질 관리

| 단계 | 명령 | 내용 |
|------|------|------|
| 정적 검사 | `npm run lint` | ESLint (react-hooks 규칙 포함), 경고 0 유지 |
| 단위 테스트 | `npm test` | `physics/`, `utils/`, 상수·스크립트 (Vitest) |
| 모델 검증 | `npm test` | `physics/validation`: 관측 진도 대비, 알려진 오차는 `it.fails` |
| 브라우저 QA | `npm run qa:earthquake`, `qa:flood` | Playwright. dev 서버와 Cesium 토큰 필요 |
| CI | `.github/workflows/ci.yml` | `main`·`dev` 푸시와 PR에서 lint → test → build |
