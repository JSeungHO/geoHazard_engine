# GeoHazard Engine — 쓰나미 모듈 기획서

> 작성일: 2026-05-24  
> 최종 갱신: 2026-05-24  
> 대상 브랜치: `dev`  
> 상태: **⏸ 보류** — Phase 1 프로토타입 완료 · Phase 2+는 **WebGL 3D 파도 통합 후** 착수  
> 참조: [tsunami-status.md](./tsunami-status.md), [goals.md](./goals.md), [features.md](./features.md)

---

## 1. 목표

| 항목 | 내용 |
|------|------|
| 목표 | 진원에서 파면(ring)이 확장되고, **한국 연안 참조 도시**에 도달하면 **파고·침수 범위(run-up)** 가 점진적으로 나타나는 교육용 쓰나미 시뮬레이션 |
| Phase | **1** 완료 (프로토타입) · **2+** WebGL 3D 파도 통합 후 |
| 재사용 | `CesiumMapViewer`, `SceneLayersPanel`, `MapStatusBar`, `SimulationErrorBoundary`, 모듈 레이아웃 패턴 |
| 신규 | `TsunamiWaveModel`, 연안 impact point, run-up wedge geometry, `GroundPrimitive` overlay |

---

## 2. 방향 전환 (2026-05)

초안에서는 **강남역 침수**(`FloodVisualization` 재사용)를 목표로 했다. 구현·QA 과정에서 아래와 같이 전환했다.

| 초기 기획 | 현재 구현 |
|-----------|-----------|
| 강남역 bounds 도달 → 수위 상승 | **연안 11개 참조 도시** 도달 → 파고·spread 표시 |
| `FloodVisualization` + `waterLevel` | **쓰나미 전용 run-up** (`buildSurgeFan` + `GroundPrimitive`) |
| `maxWaterLevel`, `floodRiseRate` | `maxWaveHeight`, `maxPropagationKm`, coastal spread |
| 시작 카메라: 진원·강남 동시 조망 | 시작 카메라: **진원 중심** (`flyToBoundingSphere`) |
| 도달 시 강남 flyTo | 도달 시 자동 flyTo **없음** — "연안 조망" 수동 버튼 |

> 강남 침수 트리거·`fixedBounds`·딥블루 홍수 mesh 연동은 **폐기**.  
> 상세 이력: [tsunami-status.md §2](./tsunami-status.md#2-설계-방향-전환-이력)

---

## 3. 시뮬레이션 개념

```
[진원] ──ring 확장──▶ [연안 참조 도시 도달] ──▶ 파고 상승 + run-up wedge 육지 확장
         (동심원)              (포항, 울산…)           (바다→육지 방향 surge)
```

1. 사용자가 **진원** 선택 (동해/서해/일본 서부 프리셋 + 지도 클릭)
2. **시작** → 진원에서 파면 ring·shockwave 확장, 카메라는 진원 중심 조망
3. ring이 연안 도시에 닿으면 **파고(m) 라벨** + **해안 run-up overlay** 표시
4. 도달 후 시간이 지날수록 파고 상승·침수 wedge가 **육지 쪽으로** 넓어짐

**교육용 단순화**: CFD·조석·실제 해안 DEM 미사용. region별 방향 + 고정 거리(m)로 해안 위치를 **근사**한다.

---

## 4. 물리 모델 (`TsunamiWaveModel.js`)

### 4.1 설계 원칙

- 결정론적 함수 — `elapsedMs`만 알면 ring·파고·spread 재계산 가능 (스크러빙 지원)
- 파속 = `waveSpeed × timeScale` (배속)
- 연안 피해는 **거리 감쇠 파고** + **도달 후 ramp** + **inland spread**

### 4.2 핵심 API

```js
export class TsunamiWaveModel {
  constructor({
    epicenter,
    waveSpeed = 200,        // m/s
    timeScale = 100,
    maxWaveHeight = 12,     // m — 연안 최대 파고
    maxPropagationKm = 500, // ring 최대 반경
  })

  getRingRadius(elapsedMs)              // min(speed×t, maxPropagationM)
  getArrivalMs(lat, lon)                // 진원→지점 도달 ms
  getCoastalWaveHeight(elapsedMs, lat, lon)  // 0 → ramp → peak (COASTAL_RAMP_MS=14s)
  getCoastalSpreadFactor(elapsedMs, lat, lon) // 0.3→1.0 (COASTAL_SPREAD_MS=22s)
  getImpactSummary(elapsedMs, points)   // ring + 연안별 reached/waveHeight/spread
  getTotalDurationMs()                  // 스크러빙 슬라이더 max
}
```

### 4.3 기본 옵션 (`tsunamiPresets.js`)

```js
export const DEFAULT_TSUNAMI_OPTIONS = {
  waveSpeed: 200,
  timeScale: 100,
  maxWaveHeight: 12,
  maxPropagationKm: 500,
}
```

### 4.4 도달 시간 예시 (timeScale=100)

| 진원 | 대표 연안 | 대략 거리 | 도달 시간 |
|------|-----------|-----------|-----------|
| 동해 근해 | 포항 | ~60 km | ~3 s |
| 동해 근해 | 강릉 | ~150 km | ~7.5 s |
| 서해 | 군산 | ~280 km | ~14 s |

---

## 5. 진원·연안 프리셋

### 5.1 진원 (`tsunamiPresets.js`)

```js
export const EPICENTER_PRESETS = [
  { id: 'east_sea',   label: '동해 근해', lat: 36.5, lon: 129.5, region: 'east' },
  { id: 'yellow_sea', label: '서해',      lat: 36.5, lon: 124.0, region: 'west' },
  { id: 'japan_west', label: '일본 서부', lat: 36.0, lon: 132.0, region: 'south' },
]
```

### 5.2 연안 참조 도시 (`coastalImpactPoints.js`)

동해·남해·서해 **11곳** (강릉, 동해, 포항, 울산, 부산, 거제, 여수, 목포, 군산, 인천, 태안).

- 진원 `region`과 일치하는 연안만 표시 (예: 동해 → east 4곳)
- 사용자 지정 진원 → 700 km 이내 최대 8곳

---

## 6. 파일 구조

```
src/
├── physics/
│   ├── TsunamiWaveModel.js
│   └── TsunamiWaveModel.test.js
└── modules/tsunami/
    ├── TsunamiModule.jsx
    ├── TsunamiModule.css
    ├── components/
    │   ├── TsunamiVisualization.jsx   ← ring, 마커, run-up sync
    │   ├── TsunamiMainUI.jsx          ← 사이드바, 타임라인, 스크러빙
    │   └── TsunamiMainUI.css
    ├── constants/
    │   ├── tsunamiPresets.js
    │   ├── coastalImpactPoints.js
    │   └── coastalSurgeLayout.js      ← 해안선·바다/육지 벡터
    └── utils/
        ├── tsunamiRunupSites.js       ← buildSurgeFan
        ├── tsunamiRunupPrimitives.js  ← GroundPrimitive layer
        └── *.test.js
```

### 재사용 컴포넌트

| 파일 | 용도 |
|------|------|
| `CesiumMapViewer.jsx` | Cesium viewer (연안 기본 뷰) |
| `SceneLayersPanel` / `SceneLayerController` | OSM 건물 토글 |
| `MapStatusBar` | 전파 중 / 피해 연안 pill |
| `SimulationErrorBoundary` | 렌더 오류 격리 |
| `CollapsibleSection` | 사이드바 섹션 |

> **`FloodVisualization`은 쓰나미 모듈에서 사용하지 않는다.**

---

## 7. 컴포넌트 설계

### 7.1 `TsunamiModule.jsx`

**역할**: 레이아웃, simState, impactSummary, 카메라, seek.

```jsx
// 주요 state
simState          // 'idle' | 'running' | 'paused' | 'done'
epicenter
tsunamiOptions    // waveSpeed, timeScale, maxWaveHeight, maxPropagationKm
impactSummary     // TsunamiVisualization → onImpactSummaryChange
impactPoints      // getImpactPointsForEpicenter(epicenter)
seekMs            // 타임라인 스크러빙
phase             // idle | traveling | impacting | done

// 카메라
idle → running: flyToEpicenterStart(viewer, epicenter, impactPoints)
수동: handleFlyToOverview → flyToOverview (연안 조망 버튼)
```

### 7.2 `TsunamiVisualization.jsx`

**역할**: Cesium Entity(ring·마커) + run-up Primitive 레이어.

| Entity ID | 내용 |
|-----------|------|
| `tsunami-epicenter` | 진원 point + "진원" label |
| `tsunami-ring` | CallbackProperty 반경 ellipse, 펄스 outline |
| `tsunami-shockwave` | TRAIL_RATIO=0.92 후행 ring |
| `tsunami-coast-{id}` | 연안 마커 + `{도시} {파고}m` label |

**rAF 루프** (80ms throttle summary):

```
tick → model.getImpactSummary(elapsed, impactPoints)
     → syncCoastalEntities(viewer, points, summary)
     → TsunamiRunupPrimitiveLayer.sync(buildRunupSites(summary, epicenter))
     → onStatsChange, onImpactSummaryChange
```

**ring**: `Entity + CallbackProperty` — Primitive 재생성 없이 반경·펄스 갱신.

**run-up**: site별 `GroundPrimitive` 1개, `getRunupStateKey()` 양자화로 **변경 시에만** 교체 (깜빡임 방지).

### 7.3 `TsunamiMainUI.jsx`

**좌측 사이드바**:

```
🌊 쓰나미 — 연안 파면 범위·피해 규모
▼ 진원 설정     [동해][서해][일본 서부] [지도에서 선택]
▼ 파면 설정     최대 파고 / 최대 전파(km)
▼ 피해 범위     파면 반경, 추정 면적, 피해 연안, 최대 파고
▼ 시뮬레이션    시작·일시정지·초기화
  타임라인      traveling → impacting → done
  스크러빙      ScrubBar (연안 도달 마커 포함)
```

---

## 8. 연안 run-up geometry

### 8.1 방향 (`coastalSurgeLayout.js`)

**region** 기준 바다→육지 방향 (진원 방향과 무관):

| region | 바다 방향 | 육지 방향 |
|--------|-----------|-----------|
| `east` | 동(+lon) | 서 |
| `west` | 서(-lon) | 동 |
| `south` | 남(-lat) | 북 |

```js
getCoastalSurgeBasis(site, epicenter)
  → shorePoint   // 도시 중심에서 바다쪽 COAST_FROM_CITY_M (~3.2 km)
  → inland/cross unit vectors

getSeaAnchor(site, epicenter)
  → shorePoint에서 offshore SEA_OFFSHORE_DISTANCE_M (~1.8 km)
```

### 8.2 부채꼴 wedge (`buildSurgeFan`)

```
[바다] ← sea edge (고정, offshore)
         ↕ wedge
[해안선] ← shorePoint
         ↕ spread ↑
[육지] ← inland front (전진)
```

- **바다쪽 변**: spread와 무관 고정
- **육지쪽 전선**: `spreadFactor`에 비례해 안쪽 확장
- 렌더: `GroundPrimitive` + `PolygonGeometry` (지형 draping)

> 해안선은 OSM/DEM이 아닌 **고정 오프셋 근사** — 도시마다 실제 만·항과 어긋날 수 있음 ([tsunami-status.md §6.1](./tsunami-status.md#61-시각화)).

---

## 9. 카메라

### 9.1 시작 시 (`flyToEpicenterStart`)

`flyToBoundingSphere` + `HeadingPitchRange` — **진원이 화면 중앙**에 오도록.

> `flyTo({ destination: epicenter, pitch })`만 쓰면 look-at이 밀려 진원이 화면 아래로 감.

```js
const range = Math.max(maxDistToImpact * 3.1, 420_000)
flyToLookAt(viewer, epicenter, { range, pitchDeg: -68 })
```

### 9.2 연안 조망 (수동)

`flyToOverview` — 진원·연안 centroid, "연안 조망" 버튼.

### 9.3 폐기된 동작

- ~~도달 시 강남 flyTo~~
- ~~도달 시 자동 연안 클로즈업~~

---

## 10. 타임라인·스크러빙

| 단계 | phase | UI |
|------|-------|-----|
| 파면 이동 | `traveling` | ring 확장, 연안 미도달 |
| 연안 피해 | `impacting` | 파고 라벨, run-up wedge |
| 완료 | `done` | max propagation 도달 |

- **ScrubBar**: `seekMs` → Visualization에서 ring·summary 즉시 반영
- 드래그 시 자동 `paused`
- `TsunamiWaveModel` 결정론적 → 과거 시점 재현 가능

---

## 11. registry.js

```js
{ id: 'tsunami', label: '쓰나미', component: TsunamiModule, available: true }
```

---

## 12. 구현 완료 체크리스트

### Phase 1 ✅

- [x] `TsunamiWaveModel.js` + 단위 테스트
- [x] `tsunamiPresets.js`, `coastalImpactPoints.js`
- [x] `TsunamiModule` / `TsunamiVisualization` / `TsunamiMainUI`
- [x] ring + shockwave CallbackProperty 펄스
- [x] 지도 클릭 진원 설정
- [x] 타임라인 + ScrubBar
- [x] 시작 카메라 진원 중심 flyTo
- [x] `registry.js` tsunami 활성화

### Phase 2 🟡 (부분)

- [x] 연안 참조 도시 마커 + 파고 UI
- [x] `buildSurgeFan` + `TsunamiRunupPrimitiveLayer`
- [x] region 기반 바다→육지 surge 방향
- [x] GroundPrimitive 렌더 크래시 수정
- [ ] 실제 해안선/OSM coastline 연동
- [ ] 바다 구간 수면 tint 가시성
- [ ] 연안 마커를 해안 anchor로 이동 (선택)

### Phase 3+ ❌

- [ ] OSM 건물 침수 shader (3a)
- [ ] camera shake, 시나리오 타임라인 (3b)
- [ ] splash/debris (4)

---

## 13. 테스트

```bash
npm test -- --run   # 35 passed (TsunamiWaveModel, coastalSurgeLayout, tsunamiRunupSites 등)
npm run build
```

### 브라우저 QA (동해 프리셋)

- [ ] 시작 → ring 진원에서 확장, 진원 화면 중앙
- [ ] 포항 등 연안 도달 → `{도시} {파고}m` 라벨
- [ ] run-up wedge가 **바다/해안에서 시작**해 육지로 확장
- [ ] 스크러빙 → ring·피해 상태 즉시 반영
- [ ] 홍수 ↔ 쓰나미 탭 전환 시 primitive·entity 정리
- [ ] GroundPrimitive 렌더 오류 없음

---

## 14. 하지 말아야 할 것

| 시도 | 이유 |
|------|------|
| ring에 Primitive + 매 프레임 재생성 | Entity + CallbackProperty 사용 |
| run-up Entity 매 80ms 재생성 | GroundPrimitive + state key 양자화 |
| `PolygonGeometry.createGeometry()` 결과를 GroundPrimitive에 전달 | `PolygonGeometry` 정의를 직접 전달 |
| 진원→도시 방향으로 run-up | 해안 **region** 방향 사용 — 진원 각도와 해안 normal 불일치 |
| 쓰나미에 `FloodVisualization` 재사용 | 도심 홍수 ≠ 연안 surge — 별도 geometry |
| 스크럽 중 `simState='idle'` | ring 제거됨 — `paused` 유지 |

---

## 15. 로드맵

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 진원 + ring + UI + 카메라 + 스크러빙 | ✅ |
| 2 | 방향성 전파, 해안 run-up | 🟡 |
| 3a | OSM 건물 침수 | ❌ |
| 3b | camera shake, UI 타임라인 | ❌ |
| 4 | splash/debris | ❌ |

---

## 16. 초기 기획 메모 (deprecated)

<details>
<summary>강남역 침수 트리거 초안 — 참고용</summary>

- ring이 강남역 bounds 도달 → `FloodVisualization` `waterLevel` 상승
- `maxWaterLevel`, `floodRiseRate`, `fixedBounds`, `createTsunamiSurfaceMaterial`
- T-1: 도달 시 `flyToGangnam`
- 타임라인: "강남역 도달" / "침수 완료" 단계

위 항목은 **구현하지 않았거나 제거**되었다. 현재 SSOT는 본 문서 §2~§8 및 [tsunami-status.md](./tsunami-status.md).

</details>

---

## 관련 문서

- [쓰나미 모듈 진행 현황](./tsunami-status.md) — **현재 상태·이슈·Git·다음 작업**
- [작업 목표](./goals.md) — Phase 1~4 로드맵
- [구현 기능](./features.md) — 모듈 라우터·체크리스트
