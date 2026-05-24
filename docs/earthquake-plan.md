# GeoHazard Engine — 지진 모듈 기획서

> 작성일: 2026-05-24  
> 대상 브랜치: `dev`  
> 상태: **Phase 3 완료** · 브라우저 QA §13 대기  
> 참조: [goals.md](./goals.md), [features.md](./features.md), [tsunami-phase1.md](./tsunami-phase1.md)

---

## 1. 목표

| 항목 | 내용 |
|------|------|
| 목표 | 한반도 단층대·해역에서 지진이 발생하고, **P파·S파 ring이 확산**되며, 카메라가 흔들리고 **주요 도시의 진도·피해** 를 시각화하는 교육용 지진 시뮬레이션 |
| 재사용 | `CesiumMapViewer`, `ModuleShell`, `MapStatusBar`, `SimulationErrorBoundary`, `CollapsibleSection`, 모듈 레이아웃 패턴 |
| 신규 | `EarthquakeWaveModel`, P파·S파 ring, 카메라 쉐이크, MMI 진도 overlay, 도시 피해 마커 |

**교육용 단순화**: 실제 지진파 굴절·반사·지반 증폭 미사용. 반무한 균질 반공간 모델 + 감쇠 공식(GMPE 간소화)으로 진도를 **근사**한다.

---

## 2. 시뮬레이션 개념

```
[진원(하이포센터)]
      ↓ 진앙(에피센터) 수직 투영
 [P파 ring] ─── 빠르게 확산 (~6 km/s) ──▶ 카메라 위치 도달 → 약한 흔들림
 [S파 ring] ─── 느리게 확산 (~3.5 km/s) ──▶ 카메라 위치 도달 → 강한 흔들림
                    ↓ S파 도달 후
        도시 마커 → MMI 진도 라벨 + 색상 변화
        지도 overlay → 진도 등진선 컬러맵
```

1. 사용자가 **진원** 선택 (한반도 주요 단층대 프리셋 + 지도 클릭) + **규모(M)** 조절
2. **시작** → 진앙에서 P파·S파 ring 동시 확산
3. S파 ring이 **카메라 위치에 도달**하면 카메라 쉐이크 발동
4. ring이 주요 도시에 닿으면 **MMI 진도 라벨** + **도시 마커 색 변화**
5. 진도 등진선 Cesium ImageryLayer overlay가 점진적으로 나타남
6. 피해 범위 패널에 추정 영향 인구·면적 표시

---

## 3. 물리 모델 (`EarthquakeWaveModel.js`)

### 3.1 설계 원칙

- **결정론적 함수** — `elapsedMs`만 알면 ring·진도·피해 상태 재계산 (스크러빙 지원)
- P파·S파 속도 상수 + `timeScale` 배속 파라미터
- MMI(수정 머캘리 진도)는 **Atkinson-Boore 간소화** 거리 감쇠로 계산
- 진원 깊이(depth)가 진앙 진도에 영향

### 3.2 지진파 속도 (교육용 크러스트 모델)

| 파 | 실제 속도 | 모델 상수 |
|----|-----------|-----------|
| P파 | ~6,000 m/s | `P_WAVE_SPEED = 6000` |
| S파 | ~3,500 m/s | `S_WAVE_SPEED = 3500` |
| Surface wave | ~3,000 m/s | Phase 2 이후 선택 구현 |

### 3.3 핵심 API

```js
export class EarthquakeWaveModel {
  constructor({
    epicenter,           // { lat, lon }
    depthKm = 10,        // 진원 깊이 (km)
    magnitude = 6.0,     // Mw 규모
    timeScale = 50,      // 배속 (실제 초당 50초 진행)
    maxPropagationKm = 800,
  })

  // 파면 반경
  getPWaveRadius(elapsedMs)          // m — P파 ring 반경
  getSWaveRadius(elapsedMs)          // m — S파 ring 반경

  // 도달 시간
  getPWaveArrivalMs(lat, lon)        // ms — 지점까지 P파 도달
  getSWaveArrivalMs(lat, lon)        // ms — 지점까지 S파 도달

  // 진도 계산 (MMI 1~12)
  getMMI(lat, lon)                   // epicentral dist + depth + magnitude → MMI
  getPGA(lat, lon)                   // Peak Ground Acceleration (g)

  // 카메라 쉐이크 강도 (S파 도달 시)
  getShakeIntensity(cameraLat, cameraLon)   // 0.0 ~ 1.0

  // 도시 피해 요약
  getImpactSummary(elapsedMs, cities)
  // → [{ cityId, pWaveReached, sWaveReached, mmi, label }]

  getTotalDurationMs()              // S파 maxPropagation 도달까지
  distanceTo(lat, lon)              // haversine (m)
  hypoDistance(lat, lon)            // √(epicentral² + depth²) (m)
}
```

### 3.4 MMI 계산 (간소화 GMPE)

```
ln(PGA) = c1 + c2·M - c3·ln(R_hypo) - c4·R_hypo
MMI = c5 + c6·ln(PGA)
```

교육용 계수 (Atkinson & Boore 2003 간소화):

| 상수 | 값 |
|------|----|
| c1 | 0.04 |
| c2 | 0.61 |
| c3 | 1.66 |
| c4 | 0.0059 |
| c5 | 3.23 |
| c6 | 1.51 |

### 3.5 진도 → 색상 매핑 (MMI 기준)

| MMI | 설명 | 색상 (hex) |
|-----|------|------------|
| I–II | 무감 | `#FFFFFF` |
| III | 미진 | `#A9F5A9` |
| IV | 경진 | `#8DD9F5` |
| V | 약진 | `#FFF87A` |
| VI | 중진 | `#FFC700` |
| VII | 강진 | `#FF8C00` |
| VIII | 열진 | `#FF4500` |
| IX+ | 격진 | `#CC0000` |

---

## 4. 진원 프리셋 (`earthquakePresets.js`)

한반도 주요 단층대·역사 지진 위치 기반:

```js
export const EPICENTER_PRESETS = [
  {
    id: 'gyeongju_2016',
    label: '경주 (2016)',
    lat: 35.76,
    lon: 129.19,
    depthKm: 15,
    magnitude: 5.8,
    description: '양산단층 — 한국 계기 지진 최대',
  },
  {
    id: 'pohang_2017',
    label: '포항 (2017)',
    lat: 36.11,
    lon: 129.36,
    depthKm: 7,
    magnitude: 5.4,
    description: '북구 북쪽 촉발 지진',
  },
  {
    id: 'yangsan_fault',
    label: '양산단층 (가상)',
    lat: 35.50,
지지    lon: 129.15,
    depthKm: 12,
    magnitude: 6.5,
    description: '한반도 최대 활단층 가상 시나리오',
  },
  {
    id: 'west_sea',
    label: '서해 해역 (가상)',
    lat: 36.0,
    lon: 124.5,
    depthKm: 20,
    magnitude: 6.0,
    description: '서해 해역 가상 시나리오',
  },
  {
    id: 'east_sea',
    label: '동해 해역 (가상)',
    lat: 37.5,
    lon: 131.5,
    depthKm: 25,
    magnitude: 6.8,
    description: '동해 해역 가상 시나리오',
  },
]

export const DEFAULT_EARTHQUAKE_OPTIONS = {
  depthKm: 10,
  magnitude: 6.0,
  timeScale: 50,
  maxPropagationKm: 800,
}
```

---

## 5. 피해 도시 (`earthquakeImpactCities.js`)

진도 계산 대상 주요 도시 (전국 분포):

| cityId | 도시 | lat | lon |
|--------|------|-----|-----|
| seoul | 서울 | 37.566 | 126.978 |
| busan | 부산 | 35.180 | 129.075 |
| daegu | 대구 | 35.872 | 128.602 |
| incheon | 인천 | 37.456 | 126.705 |
| gwangju | 광주 | 35.160 | 126.852 |
| daejeon | 대전 | 36.350 | 127.385 |
| ulsan | 울산 | 35.538 | 129.311 |
| gyeongju | 경주 | 35.855 | 129.225 |
| pohang | 포항 | 36.019 | 129.343 |
| jeonju | 전주 | 35.824 | 127.148 |
| changwon | 창원 | 35.228 | 128.681 |
| jeju | 제주 | 33.499 | 126.531 |

---

## 6. 파일 구조

```
src/
├── physics/
│   ├── EarthquakeWaveModel.js
│   └── EarthquakeWaveModel.test.js
└── modules/earthquake/
    ├── EarthquakeModule.jsx         ← 상태, 카메라 flyTo, 쉐이크 조율
    ├── EarthquakeModule.css
    ├── components/
    │   ├── EarthquakeVisualization.jsx  ← P파·S파 ring, 도시 마커, 진도 overlay
    │   ├── EarthquakeMainUI.jsx         ← 사이드바, 진원·규모 설정, 타임라인
    │   └── EarthquakeMainUI.css
    ├── constants/
    │   ├── earthquakePresets.js         ← 진원 프리셋, 기본 옵션
    │   └── earthquakeImpactCities.js    ← 피해 대상 도시 좌표
    └── utils/
        ├── earthquakeMMILayer.js        ← 진도 등진선 Cesium overlay
        ├── earthquakeBuildingEffects.js ← OSM 건물 손상색 + CustomShader 흔들림
        ├── cameraShake.js               ← 카메라 흔들림 애니메이션
        └── earthquakeMMILayer.test.js
```

---

## 7. 컴포넌트 설계

### 7.1 `EarthquakeModule.jsx`

**역할**: 레이아웃, simState, impactSummary, 카메라, seek.

```jsx
// 주요 state
simState         // 'idle' | 'running' | 'paused' | 'done'
epicenter        // { lat, lon }
options          // depthKm, magnitude, timeScale, maxPropagationKm
impactSummary    // EarthquakeVisualization → onImpactSummaryChange
seekMs           // 스크러빙
phase            // 'idle' | 'pwave' | 'swave' | 'shaking' | 'done'
isShaking        // boolean — S파 카메라 위치 도달 여부

// 카메라
idle → running: flyToEpicenterView(viewer, epicenter)
  → flyToBoundingSphere으로 진앙 중심, pitchDeg: -60, range: maxPropagation × 1.5
```

### 7.2 `EarthquakeVisualization.jsx`

**역할**: Cesium Entity (P파·S파 ring·도시 마커) + 진도 ImageryLayer.

| Entity ID | 내용 |
|-----------|------|
| `eq-epicenter` | 진앙 point + "진앙" label |
| `eq-pwave-ring` | P파 확산 ring (흰색·빠름, CallbackProperty 반경) |
| `eq-swave-ring` | S파 확산 ring (주황색·느림, CallbackProperty 반경) |
| `eq-city-{id}` | 도시 마커 + `{도시} MMI {n}` label |

**rAF 루프** (80ms throttle):

```
tick → model.getImpactSummary(elapsed, cities)
     → syncCityEntities(viewer, cities, summary)
     → syncMMILayer(viewer, summary)       ← 진도 ImageryLayer 업데이트
     → checkCameraShake(viewer, model)    ← S파 카메라 도달 감지
     → onImpactSummaryChange(summary)
```

**P·S파 ring**: `Entity + CallbackProperty` 반경 — Primitive 재생성 없이 갱신.  
P파: 흰색 점선 ellipse outline / S파: 주황 solid ellipse outline + glow.

### 7.3 `EarthquakeMainUI.jsx`

**좌측 사이드바**:

```
🌍 지진 — 지진파 전파·진도 분포
▼ 진원 설정     [경주][포항][양산단층][서해][동해] [지도에서 선택]
▼ 지진 설정     규모(M) 슬라이더 4.0~8.0 / 진원 깊이(km)
▼ 피해 범위     P파 반경, S파 반경, 영향 도시 수, 최대 진도(MMI)
▼ 시뮬레이션    시작·일시정지·초기화
  타임라인      P파 전파 → S파 도달 → 흔들림 → 완료
  스크러빙      ScrubBar (P파·S파 도달 마커 포함)
```

---

## 8. 카메라 쉐이크 (`cameraShake.js`)

S파 ring이 카메라 위치(뷰어 중심)에 도달하는 순간 발동.

### 8.1 쉐이크 알고리즘

```js
export function startCameraShake(viewer, intensity, durationMs = 3000) {
  // intensity: 0.0 ~ 1.0 (MMI 기반)
  // Cesium postUpdate 이벤트 사용
  const startTime = performance.now()
  const MAX_OFFSET_DEG = intensity * 0.003   // 최대 각도 오프셋 (degree)
  const FREQ = 8 + intensity * 12            // 진동 주파수 (Hz 근사)

  viewer.scene.postUpdate.addEventListener(function shake() {
    const t = (performance.now() - startTime) / 1000
    const envelope = Math.max(0, 1 - t / (durationMs / 1000))  // 감쇠 envelope

    if (envelope <= 0) {
      viewer.scene.postUpdate.removeEventListener(shake)
      return
    }

    const dx = Math.sin(FREQ * t * 2 * Math.PI) * MAX_OFFSET_DEG * envelope
    const dy = Math.cos(FREQ * t * 1.7 * Math.PI) * MAX_OFFSET_DEG * envelope * 0.6

    // 카메라 heading/pitch에 미세 오프셋
    const c = viewer.camera
    c.setView({
      orientation: {
        heading: c.heading + Cesium.Math.toRadians(dx),
        pitch: c.pitch + Cesium.Math.toRadians(dy),
        roll: c.roll,
      },
    })
  })
}
```

### 8.2 쉐이크 강도 테이블

| MMI | intensity | 지속 시간 |
|-----|-----------|-----------|
| ≤ IV | 0.1 | 1,000 ms |
| V | 0.3 | 2,000 ms |
| VI | 0.5 | 3,000 ms |
| VII | 0.7 | 4,000 ms |
| VIII+ | 1.0 | 5,000 ms |

> **스크러빙 시 쉐이크 비활성화**: `seekMs` 점프 시 쉐이크 발동하지 않음 (혼동 방지).

---

## 9. 진도 등진선 overlay (`earthquakeMMILayer.js`)

### 9.1 접근 방식

Cesium `SingleTileImageryProvider` + 동적 캔버스 렌더링.

```js
export function buildMMICanvas(epicenter, model, width = 512, height = 512, bounds) {
  // bounds: { west, south, east, north } — 화면 viewport
  // pixel → lon/lat → model.getMMI() → MMI 색상
  // 반환: OffscreenCanvas (혹은 HTMLCanvasElement)
}

export function syncMMILayer(viewer, model, options = {}) {
  // postUpdate마다 캔버스 재생성 → SingleTileImageryProvider 교체
  // 성능: S파 도달 도시 수 변화 시에만 갱신
}
```

### 9.2 성능 제약

| 방식 | 업데이트 빈도 | 비고 |
|------|--------------|------|
| 매 프레임 캔버스 재생성 | ❌ | 512×512 픽셀 계산 → 드롭 |
| 상태 변화 시만 갱신 | ✅ | 도달 도시 수 변경 시 트리거 |
| 미리 계산된 lookup table | ✅ | 기동 시 1회 계산, 이후 LUT 참조 |

> **초기 구현**: overlay 없이 도시 마커 MMI 라벨만으로 시작. **Phase 2 (2026-05-24)**: `earthquakeMMILayer.js` — S파 도달 영역 캔버스 overlay, 50 km bucket 갱신.

---

## 10. 타임라인 · 스크러빙

| 단계 | phase | UI |
|------|-------|----|
| 대기 | `idle` | ring 없음 |
| P파 전파 | `pwave` | P파 ring 확산, 도시 미도달 |
| S파 전파 | `swave` | 양 ring 확산, P파 도달 도시 라벨 표시 |
| 흔들림 | `shaking` | S파 도달 도시 진도 라벨, 카메라 쉐이크 |
| 완료 | `done` | 최대 전파 도달, 전체 피해 요약 |

**ScrubBar 마커**:
- P파 도착 시각 (각 도시)
- S파 도착 시각 (각 도시)
- 카메라 위치 S파 도달 시각

---

## 11. Phase 계획

| Phase | 내용 | 난이도 | 상태 |
|-------|------|--------|------|
| **1** | 진원 UI + P파·S파 ring + 카메라 쉐이크 + 도시 마커 | ★★☆ | ✅ 완료 (QA §13 대기) |
| **2** | MMI 진도 등진선 overlay + 규모·깊이 슬라이더 + 피해 통계 | ★★★ | ✅ 완료 |
| **3** | OSM 건물 흔들림·손상 (3D Tileset shader / 색상 변경) | ★★★ | ✅ 완료 |
| **4** (선택) | 여진 시퀀스, 지표 균열 라인, 액상화 영역 overlay | ★★★ | ❌ 장기 |

### Phase 1 구현 체크리스트

> 완료일: 2026-05-24

```
[x] EarthquakeWaveModel.js — P/S파 반경·도달·MMI 순수 함수
[x] EarthquakeWaveModel.test.js — 단위 테스트 35개 (전체 통과)
[x] earthquakePresets.js — 5개 프리셋 + DEFAULT_OPTIONS
[x] earthquakeImpactCities.js — 12개 주요 도시
[x] EarthquakeModule.jsx — 상태·카메라·simState
[x] EarthquakeVisualization.jsx — P파·S파 ring + 도시 마커 + 쉐이크
[x] EarthquakeMainUI.jsx + .css — 사이드바 UI
[x] cameraShake.js — postUpdate 기반 쉐이크
[x] registry.js earthquake available: true 변경
[ ] 브라우저 QA (아래 §13)
```

**GMPE 보정 (2026-05-24)**: 스펙 원안 C5=3.23, C6=1.51이 한반도 거리 스케일(50~300km)에서
전부 MMI=1로 수렴하는 문제 발견 → USGS ShakeMap Worden et al. 2012 기반으로 C5=7.58, C6=0.955 적용.
검증: 경주(M5.8) 기준 부산(~67km)→MMI 4, 포항(M5.4) 시내(~5km)→MMI 7.

### Phase 2 구현 체크리스트

> 완료일: 2026-05-24

```
[x] earthquakeMMILayer.js — S파 도달 영역 MMI ImageryLayer
[x] earthquakeMMILayer.test.js
[x] 규모(M)·깊이 슬라이더 — EarthquakeMainUI (idle 잠금)
[x] 추정 면적 πr² · 추정 인구 (MMI 가중치)
[x] earthquakeImpactCities.js — 도시별 population 필드
[x] getMMIExposureFactor / estimateAffectedPopulation
```

### Phase 3 구현 체크리스트

> 완료일: 2026-05-24

```
[x] earthquakeBuildingEffects.js — Cesium3DTileStyle 손상색
[x] CustomShader vertex 흔들림 (running + MMI V+)
[x] SceneLayerController.instancesRef — OSM tileset 공유
[x] EarthquakeVisualization 연동 (idle/reset clear)
[x] earthquakeBuildingEffects.test.js
[ ] OSM 건물 ON 상태 브라우저 QA (§13)
```

---

## 12. 재사용 컴포넌트

| 파일 | 용도 |
|------|------|
| `CesiumMapViewer.jsx` | Cesium viewer |
| `SceneLayersPanel` / `SceneLayerController` | OSM 건물 토글 |
| `MapStatusBar` | 진행 상태 pill |
| `SimulationErrorBoundary` | 렌더 오류 격리 |
| `CollapsibleSection` | 사이드바 섹션 |

> `FloodVisualization`, `TsunamiVisualization`은 지진 모듈에서 **사용하지 않는다.**

---

## 13. 브라우저 QA 체크리스트 (Phase 1)

```
[ ] 시작 → P파 ring이 진앙에서 빠르게 확산
[ ] S파 ring이 P파보다 느리게 확산, 두 ring이 동시에 보임
[ ] P파 도달 도시 → 마커 라벨 변화 (회색 → 색상)
[ ] S파 도달 → 카메라 쉐이크 발동 (진앙 가까운 카메라에서 확인)
[ ] 도시 마커 MMI 라벨 표시 (서울/경주 등)
[ ] 피해 범위 패널 숫자 갱신
[ ] 일시정지 / 재개 / 초기화 정상 동작
[ ] 스크러빙 슬라이더 → ring 즉시 반영, 쉐이크 미발동
[ ] 홍수/쓰나미 탭 전환 후 지진 탭 재진입 → 잔여 객체 없음
[ ] 경주·포항 프리셋 → 해당 위치 진앙 표시
[ ] 지도 클릭 → 클릭 위치로 진앙 이동
[ ] 규모(M) 변경 → 진도 재계산 확인
```

---

## 14. 하지 말아야 할 것

| 시도 | 이유 |
|------|------|
| ring에 Primitive + 매 프레임 재생성 | Entity + CallbackProperty 사용 (tsunami 패턴) |
| 스크러빙 중 카메라 쉐이크 발동 | 혼란 초래 — `seekMs` 점프 시 쉐이크 건너뜀 |
| `postUpdate`에서 매 프레임 MMI 캔버스 재생성 | 도달 도시 수 변화 시에만 갱신 |
| 진원 깊이 0km 허용 | 최소 1km — 0이면 수직 거리 0으로 MMI 발산 |
| `FloodVisualization` 재사용 | 지진 ≠ 침수 — 별도 geometry |
| Primitive 직접 vertex buffer 업데이트 시도 | Cesium 공개 API 없음 — 교체 방식 유지 |

---

## 15. 진앙 위치 시스템

쓰나미와 동일 패턴:

```js
// locations/fault_zones.js (예정)
export const YANGSAN_FAULT = { lat: 35.50, lon: 129.15 }
export const DONGHAE_OFFSHORE = { lat: 37.50, lon: 131.50 }
```

현재는 `earthquakePresets.js`에 좌표 포함, 추후 `locations/` 분리.

---

## 16. 관련 문서

| 문서 | 용도 |
|------|------|
| [goals.md](./goals.md) | 로드맵, Phase 계획 |
| [features.md](./features.md) | 전체 파일 구조, 모듈 라우터 |
| [tsunami-phase1.md](./tsunami-phase1.md) | 설계 패턴 참고 (ring, 스크러빙, 카메라) |
| [tsunami-status.md](./tsunami-status.md) | 쓰나미 현재 상태 |
