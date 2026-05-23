# GeoHazard Engine — 기획·테스트 평가 보고서

> 작성일: 2026-05-24  
> 작성 관점: 기획자 + QA 테스터  
> 대상 브랜치: `dev`  
> 평가 범주: UX, 코드 품질, 아키텍처, 로드맵 타당성

### 코드 반영 현황 (2026-05-24)

| ID | 상태 |
|----|------|
| B-1 | ✅ 경계 셀 흡수 damping |
| B-2 | ✅ body 재생성 0.05m 임계값 |
| B-3 | ✅ Cartesian3 scratch 재사용 |
| B-4 | ✅ 카메라 고도 비례 emitter |
| B-5 | ✅ RAIN_STREAK_IMAGE 상수화 |
| B-6 | ✅ auto-rise drainage |
| B-7 | ✅ SimulationErrorBoundary |
| B-8 | ✅ terrainGridChanged min/max fast-path |
| U-1 | ✅ WelcomeOverlay |
| U-2 | ✅ 슬라이더 힌트 (mm/h, 저지대 m) |
| U-3 | ✅ 초기화 버튼 |
| U-6 | ✅ 지형 정밀화 배지 |
| A-1 | ✅ `modules/flood/` 디렉토리 정리 |
| A-2 | ✅ `App.jsx` + `ModuleShell` 모듈 라우터 |
| A-3 | ✅ `locations/gangnam.js` 좌표 통합 |
| A-4 | ✅ Vitest 단위 테스트 17개 |

---

## 1. 총평

홍수 엔진의 핵심 렌더링 파이프라인은 **완성도가 높다**. Primitive 기반 수면, terrain grid 클램핑, view bounds 연동까지 기술적으로 잘 설계되어 있으며 Cesium 관용 패턴(viewerRef 단일 인스턴스, rAF 분리)도 충실히 따르고 있다.

그러나 **제품으로서의 완성도**는 아직 낮다. 사용자가 처음 열었을 때 무엇을 하는 앱인지, 슬라이더가 어떤 의미인지 알 수 없다. 강남역이라는 단일 지점에 고정되어 있어 재사용성이 없고, 다음 재난 모듈을 추가하기 전에 해결해야 할 기술 부채도 존재한다.

---

## 2. 버그 / 기술 문제

### 🔴 HIGH — 즉시 수정 권장

#### B-1. WaterWaveEngine 경계 셀 고정 (edge cells = 0 고착)

```js
// WaterWaveEngine.js:23
for (let y = 1; y < res - 1; y++) {   // ← y=0, y=res-1 제외
  for (let x = 1; x < res - 1; x++) { // ← x=0, x=res-1 제외
```

- **현상**: 격자 4면 테두리(y=0, y=res-1, x=0, x=res-1)는 `step()`에서 절대 갱신되지 않는다. 항상 height=0으로 고정되어 있어 수면 경계에서 파동이 흡수되지 않고 **반사파가 꺾여 보이는 아티팩트**가 발생한다.
- **원인**: 수치 안정을 위해 경계를 건드리지 않는 패턴이지만, 흡수 경계 조건(absorbing BC)이나 제로-기울기 조건(Neumann BC)이 적용되지 않음.
- **수정안**: 경계 셀에 damping-only 업데이트 적용 (velocity × damping, height 불변) 또는 `heights[경계] *= 0.8` 흡수 처리.

#### B-2. FloodBodyPrimitive 매 프레임 재생성

```js
// FloodVisualization.jsx:240 (postUpdate 내부)
if (sim.baseLevel !== level) {
  removePrimitive(viewer, sim.body)
  sim.body = createFloodBodyPrimitive(...)  // ← Geometry + Primitive 풀 재생성
```

- **현상**: 수위가 1px라도 변할 때마다 3D body Geometry 전체를 새로 생성한다. Auto-rise(50ms tick) + 슬라이더 드래그 조합 시 초당 수십 번 Primitive 재생성 → GC 압박 + 프레임 드롭.
- **수정안**: docs에 이미 "성능 2차" 항목으로 기록되어 있으나 우선순위 상향 필요. 수위 변화량이 임계값(예: 0.05m) 이하이면 body 재생성 건너뛰기, 또는 ExtrudedPolygon / buffer 직접 업데이트 방식 검토.

#### B-3. `buildFloodBodyGeometry` 루프 내 매 버텍스 `new Cartesian3()` 할당

```js
// floodWaterMesh.js:282
const pushVertex = (lon, lat, height) => {
  const c = cartesianFromLonLatHeight(lon, lat, height, new Cartesian3()) // ← 매번 new
```

- **현상**: 28×28 격자 기준 최대 ~6,272개 Cartesian3 객체가 body 재생성마다 할당·폐기. B-2와 결합하면 GC 스파이크 가속.
- **수정안**: scratch 객체를 루프 밖에 단 하나 선언하고 재사용.

---

### 🟡 MEDIUM — 단기 내 개선 권장

#### B-4. 강수 파티클 고도 고정 (600m)

```js
// RainSystem.jsx:13
const EMITTER_ALTITUDE = 600
```

- **현상**: 카메라가 지표 근처(50m 이하)로 내려오면 비가 화면 위쪽이 아니라 **지면 아래에서 올라오는 것처럼** 보일 수 있다. 반대로 줌아웃하면 비가 보이지 않는다.
- **수정안**: `EMITTER_ALTITUDE = Math.max(camera.positionCartographic.height × 1.2, 300)` 처럼 카메라 고도에 비례하여 동적 계산.

#### B-5. `createRainStreakImage()` 마운트마다 캔버스 생성

```js
// RainSystem.jsx:26
const createRainStreakImage = () => {
  const canvas = document.createElement('canvas')
  // ... toDataURL 변환
}
```

- **현상**: 컴포넌트가 언마운트/재마운트될 때마다 캔버스를 만들고 base64로 직렬화. 불필요한 CPU 소비.
- **수정안**: 모듈 최상단에 한 번만 실행되도록 `const RAIN_IMAGE = createRainStreakImage()` 상수화.

#### B-6. 자동 수위 상승에 감소 로직 없음

```js
// useRainWaterAccumulation.js
// 상승만 있고 하강 없음
```

- **현상**: 강수를 줄여도 이미 쌓인 수위는 유지된다. 수동으로 슬라이더를 내려야 해서 비직관적.
- **수정안**: `autoWaterRise`가 활성화된 상태에서 강수량 < 임계값이면 수위를 천천히 감소시키는 drainage 로직 추가.

#### B-7. 에러 경계(Error Boundary) 없음

- **현상**: `FloodVisualization`이나 `RainSystem`에서 Cesium Geometry 생성 오류 발생 시 `console.error`만 찍고 앱이 불완전한 상태로 유지. React Error Boundary가 없어 오류 화면도 표시되지 않음.
- **수정안**: `FloodModule.jsx`에 `<ErrorBoundary fallback={<SimulationError />}>`로 감싸기.

---

### 🟢 LOW — 장기 개선

#### B-8. `terrainGridChanged` O(n) 전체 비교

- 3136개 셀(56×56)을 하나하나 비교. 호출 빈도가 낮아 현재는 무해하지만, 해상도 증가 시 병목 가능.
- 수정안: `minHeight` / `maxHeight` 차이를 먼저 비교하고, 통과 시에만 샘플 비교.

---

## 3. UX / 제품 문제

### 🔴 HIGH

#### U-1. 온보딩 없음 — "이게 뭔가요?"

- 앱을 처음 열면 3D 지도와 슬라이더만 있다. 무엇을 시뮬레이션하는지, 강남역이 왜 기준인지, 슬라이더가 어떤 단위인지 **설명이 전혀 없다**.
- 개선안: 첫 방문 시 "강남역 침수 시뮬레이션 — 강수량을 올리고 수위를 조절해 보세요" 형태의 Tooltip/Welcome 오버레이 1장.

#### U-2. 슬라이더 단위·의미 불명확

- `수위: 3.50 m` — 이게 해수면 기준인지, 저지대 기준인지, 1층 침수가 몇 m인지 사용자는 알 수 없다.
- `강수: 72%` — % 단위가 무엇의 %인지 불명확 (mm/h 환산 없음).
- 개선안:
  - 수위 슬라이더 아래 `💧 저지대 대비 +X.X m (지하철 1층 ≈ 5m)` 힌트 표시.
  - 강수 슬라이더에 `72% ≈ 약 130mm/h (호우경보 기준)` 병기.

#### U-3. 리셋 버튼 없음

- 자동 상승 + 강수 조합으로 수위 100m까지 올라가면 원래 상태로 돌아오려면 슬라이더 3개를 모두 수동으로 0으로 내려야 한다.
- 개선안: 헤더 또는 푸터에 `초기화` 버튼 한 개.

---

### 🟡 MEDIUM

#### U-4. 시뮬레이션 옵션이 물리 파라미터 직접 노출

- `waveTimeScale`, `waveStiffness` 등은 개발자 디버깅 용어다. 일반 사용자에게는 의미가 없다.
- 개선안 (두 가지 중 선택):
  - **A. 프리셋 방식**: "잔잔 / 보통 / 폭풍" 3단계 버튼으로 내부 파라미터 일괄 조정.
  - **B. 레이블 개선**: 기술 용어 대신 `파도 빠르기`, `파도 거칠기`, `물 투명도` 같은 직관적 명칭 사용.
  - 시뮬레이션 옵션 패널은 기본 `접힘` 상태가 적절 (현재도 그렇게 되어 있어 OK).

#### U-5. 상태바가 개발자 정보만 제공

- 하단 상태바: 경위도, 카메라 고도, 표고 → 이 정보는 일반 사용자에게 무의미하다.
- 개선안: `침수 위험 구역: X개 셀`, `현재 표고: Ym (침수선 -Zm)` 처럼 **재난 문맥** 정보 추가.

#### U-6. 로딩 상태 표시 없음

- 지형 async 샘플링 중 (`sampleTerrainHeightGridAsync`, `refineTerrainHeightGrid`) 사용자에게 아무 피드백이 없다. 수면 경계가 갑자기 바뀌어 보여도 이유를 알 수 없다.
- 개선안: 지형 로딩 중 지도 위 `🔄 지형 정밀화 중...` 작은 배지.

#### U-7. 프리셋 시나리오 없음

- "2022년 강남역 침수", "소나기", "태풍급 집중호우" 같은 실제 사례 기반 프리셋이 있으면 교육적 가치가 크게 높아진다.
- 개선안: 사이드바 상단 `📋 시나리오` 드롭다운으로 수위/강수 값 세트 로드.

#### U-8. 모바일 미지원

- 좌측 사이드바 320px 고정 + 우측 280px 고정으로 1000px 미만 화면에서 레이아웃 파괴.
- 개선안 (단기): 768px 이하에서 "데스크탑에서 이용하세요" 안내. (장기) 반응형 레이아웃.

---

## 4. 아키텍처 문제

### A-1. 모듈 경계 불일치 — `modules/flood/` vs `components/`

현재 구조:
```
src/
  modules/flood/
    FloodModule.jsx       ← 모듈
    useMapLayout.js       ← 모듈 훅
    useRainWaterAccumulation.js
  components/
    FloodVisualization.jsx  ← 홍수 전용 컴포넌트인데 여기 있음
    RainSystem.jsx           ← 동일 문제
    FloodMainUI.jsx          ← 동일 문제
```

- 쓰나미 모듈이 추가되면 `components/`에 홍수·쓰나미 컴포넌트가 뒤섞인다.
- **권장 구조**:
  ```
  src/modules/flood/
    FloodModule.jsx
    FloodVisualization.jsx
    FloodMainUI.jsx
    RainSystem.jsx
    hooks/
      useMapLayout.js
      useRainWaterAccumulation.js
  src/components/  ← 진짜 공용 컴포넌트만
    CollapsibleSection.jsx
    MapStatusBar.jsx
  ```

### A-2. `App.jsx`가 라우팅 없는 단일 모듈

```js
// App.jsx
function App() { return <FloodModule /> }
```

- 지진·쓰나미 모듈 추가 시 App.jsx가 `if/switch`로 오염된다.
- 개선안: React Router (또는 간단한 `useState`-based 모듈 셀렉터)로 모듈 전환 체계 미리 마련.

### A-3. 강남역 좌표가 여러 파일에 분산

```
src/constants/gangnam.js          ← 기준 좌표
src/utils/floodViewBounds.js      ← getDefaultFloodBounds (강남 fallback)
src/components/CesiumMapViewer.jsx ← 강남 카메라 초기값
src/utils/flyToGangnam.js         ← 강남 flyTo
```

- 다른 지역 지원 시 4곳 이상을 동시에 수정해야 한다.
- 개선안: `src/locations/gangnam.js`에 좌표·카메라·초기 bounds를 하나로 통합.

### A-4. 테스트 코드 전무

- `WaterWaveEngine`, `terrainHeight` 유틸, `floodViewBounds`의 순수 함수들은 WebGL 없이 단위 테스트 가능하다.
- 개선안: Vitest + 최소한 WaterWaveEngine step/disturbance, getFloodBaselineHeight, boundsChanged 3개 테스트 추가.

---

## 5. 로드맵 타당성 평가

### 현재 계획 (docs/goals.md 기준)

```
1. 성능 2차 (Primitive buffer update)
2. 쓰나미 모듈 Phase 1-4
3. 지진 모듈
```

### 평가

| 항목 | 평가 | 이유 |
|------|------|------|
| 성능 2차 우선순위 | ✅ 타당 | 쓰나미도 같은 Primitive 패턴 상속 예정 → 지금 안 고치면 두 배 기술 부채 |
| 쓰나미 Phase 1 범위 | ✅ 적절 | 진원 UI + 반경 확장 ring = 홍수 재사용 가능, 1~2주 내 구현 가능 |
| 쓰나미 Phase 3 범위 | ⚠️ 과대 | 건물 침수 + camera shake + UI 타임라인 = 홍수 전체 모듈과 맞먹는 볼륨. **Phase 3를 3a/3b로 분리** 권장 |
| 지진 모듈 순서 | ⚠️ 재검토 | 쓰나미 4단계 전부 끝내고 지진 시작 시 6개월 이상 소요 예상. 지진 Phase 1(camera shake만)은 단독으로 빠르게 구현 가능 |
| 산불·태풍 등 | ❌ 범위 초과 | 교육용 플랫폼 특성상 홍수/쓰나미/지진 3가지 완성도를 높이는 것이 산불까지 손대는 것보다 가치 있음 |

### 권장 수정 로드맵

```
[즉시 — 1주]
  - B-1 경계 셀 흡수 BC
  - B-3 Cartesian3 scratch 재사용
  - B-5 RainStreakImage 상수화
  - U-3 초기화 버튼
  - U-6 지형 로딩 배지

[단기 — 2~3주]
  - B-2 성능 2차 (수위 변화 임계값 + buffer 재사용)
  - B-6 drainage 로직
  - U-1 Welcome 온보딩
  - U-2 슬라이더 단위 힌트
  - A-1 모듈 디렉토리 정리 (파일 이동)
  - A-2 App.jsx 모듈 라우터

[중기 — 1개월]
  - U-4 시뮬레이션 옵션 프리셋
  - U-7 프리셋 시나리오
  - A-4 단위 테스트 최소 커버
  - 쓰나미 Phase 1 (진원 + ring)
  - 쓰나미 Phase 2 (방향성 전파)

[장기 — 2~3개월]
  - 쓰나미 Phase 3a (건물 침수 shader)
  - 지진 Phase 1 (camera shake 단독)
  - 쓰나미 Phase 3b (타임라인 UI)
  - 지진 Phase 2 (건물 흔들림)
  - A-3 위치 추상화 (강남 외 지점 지원)
```

---

## 6. 잘 된 점 (유지할 것)

| 항목 | 평가 |
|------|------|
| `viewerRef` 단일 인스턴스 패턴 | Cesium viewer 재마운트 없이 내부 객체만 수정 — 정확한 접근 |
| view bounds + pitch 연동 | 침수·강수가 카메라가 보는 영역에만 렌더링 — 성능·비주얼 모두 good |
| rAF + postUpdate 역할 분리 | 물리(postUpdate) vs 렌더(rAF) 분리 — React 루프 오염 없음 |
| `terrainSampleToken` 취소 패턴 | 이전 async 작업을 토큰으로 무효화 — race condition 방지 |
| `FloodPhysicsWater` 셰이더 | 외부 텍스처 미사용, Fabric 커스텀 — Vite dev 오류 없이 안정적 |
| 문서화 | `docs/` 분리, 기능·설계·목표 분리 — 개발자 온보딩에 좋음 |
| Vercel 자동 배포 | `dev` Preview + `main` Production 워크플로 — CI/CD 기반 완비 |

---

## 7. 테스터 체크리스트 (다음 릴리스 전 확인 항목)

- [ ] 수위 0 → 100 자동 상승 후 수동 슬라이더 0으로 내렸을 때 Primitive 완전 제거 확인
- [ ] 카메라 회전·줌 중 flood/rain bounds가 정상 갱신되는지 확인 (debounce 200ms)
- [ ] 강수량 0인 상태에서 파티클이 show=false인지 확인 (파티클 0개 보장)
- [ ] 빠른 슬라이더 드래그(300ms 이내 다중 변경) 시 viewer 크래시 없는지 확인
- [ ] 페이지 새로고침 후 Cesium viewer가 한 번만 마운트되는지 확인 (StrictMode double-invoke 포함)
- [ ] OSM 건물 토글 ON/OFF 반복 시 메모리 누수 없는지 확인
- [ ] 침수 깊이가 지형 최고점보다 크면 전체 뷰가 물로 덮이는지 확인
- [ ] 시뮬레이션 옵션 변경이 즉시 수면 반영되는지 확인 (simulationOptionsRef 경유)

---

## 관련 문서

- [구현 기능](./features.md)
- [작업 목표](./goals.md) — 평가 반영 수정 로드맵
- [디자인 가이드](./design.md) — UX 개선 백로그·UI 스펙
