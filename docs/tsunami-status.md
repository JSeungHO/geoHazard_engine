# 쓰나미 모듈 — 현재 상황 및 진행 현황

> **상태: ⏸ 보류 (2026-05-24)** — UI 탭 **미노출** (`MODULE_REGISTRY`에서 제거). 홍수 모듈 우선. 코드는 `src/modules/tsunami/`에 보존.

> 작성일: 2026-05-23  
> 대상: `src/modules/tsunami/` 및 관련 물리·렌더 코드  
> 관련 문서: [tsunami-phase1.md](./tsunami-phase1.md) (초기 기획), [features.md](./features.md), [goals.md](./goals.md)

---

## 1. 요약

쓰나미 모듈은 **교육용 연안 쓰나미 시뮬레이션**으로, 진원에서 퍼지는 파면(ring)과 연안 참조 도시별 피해 규모(파고·침수 범위)를 보여 준다.

초기 기획(강남역 침수 트리거)에서 **방향을 전환**했다. 쓰나미는 홍수 엔진을 그대로 재사용하는 **도심 침수**가 아니라, **동해·서해·남해 연안**을 중심으로 한 **파면 전파 + 해안 run-up** 시각화에 집중한다.

| 구분 | 상태 |
|------|------|
| 모듈 등록·UI·시뮬레이션 루프 | ✅ 동작 |
| 진원 ring / shockwave 애니메이션 | ✅ 동작 |
| 연안 도시 마커 + 파고 라벨 | ✅ 동작 |
| 연안 run-up 침수 overlay | 🟡 동작 (튜닝 중) |
| 단위 테스트 | ✅ 35개 통과 |
| Git 커밋 | ❌ **미커밋** (로컬 작업 중) |

---

## 2. 설계 방향 전환 이력

### 2.1 초기 기획 (tsunami-phase1.md)

- 진원에서 ring 확장 → **강남역 도달 시 홍수 엔진 트리거**
- `FloodVisualization` 재사용, `fixedBounds`로 광역 카메라 대응

### 2.2 현재 방향 (2026-05-23 기준)

| 항목 | 변경 내용 |
|------|-----------|
| 지리적 초점 | 강남역 → **한국 연안 참조 도시** (포항, 울산, 부산 등) |
| 침수 방식 | 홍수 mesh 재사용 ❌ → **쓰나미 전용 run-up wedge** |
| 시각 목표 | 도심 범람 ❌ → **바다→육지 방향 surge + 파면 ring** |
| UI 초점 | 수위 m ❌ → **파고 m, 피해 반경 km, 영향 연안 수** |

---

## 3. 아키텍처 (현재)

```
src/
├── physics/
│   ├── TsunamiWaveModel.js          ← 순수 JS 파면·도달·파고·확산 모델
│   └── TsunamiWaveModel.test.js
└── modules/tsunami/
    ├── TsunamiModule.jsx            ← 레이아웃, 카메라, simState
    ├── components/
    │   ├── TsunamiMainUI.jsx        ← 진원·파면·피해 범위 UI
    │   └── TsunamiVisualization.jsx ← Cesium Entity + Primitive 레이어
    ├── constants/
    │   ├── tsunamiPresets.js        ← 진원 프리셋, waveSpeed/timeScale 등
    │   ├── coastalImpactPoints.js   ← 연안 참조 도시 11곳
    │   └── coastalSurgeLayout.js    ← 해안선·바다/육지 방향 벡터
    └── utils/
        ├── tsunamiRunupSites.js     ← 부채꼴 surge fan geometry
        ├── tsunamiRunupPrimitives.js← GroundPrimitive overlay 레이어
        └── *.test.js
```

### 3.1 시각 레이어

| 레이어 | 구현 | 설명 |
|--------|------|------|
| 진원 마커 | Cesium **Entity** (point + label) | "진원" 표시 |
| 파면 ring | Cesium **Entity** (ellipse + CallbackProperty) | 반경·펄스 애니메이션 |
| shockwave | Cesium **Entity** (trailing ellipse) | ring 뒤 역위상 파동 |
| 연안 마커 | Cesium **Entity** (point + label) | 도달 시 `포항 11.0m` 형식 |
| 연안 run-up | **GroundPrimitive** (site별 1개) | 지형에 붙는 flat 침수 polygon |

### 3.2 물리 모델 (`TsunamiWaveModel`)

- **ring 반경**: `waveSpeed × timeScale × elapsed` (maxPropagationKm 캡)
- **도달 시간**: 진원→연안 haversine / effectiveSpeed
- **파고 상승**: 도달 후 `COASTAL_RAMP_MS`(14s) 동안 ease-out
- **침수 확산**: 도달 후 `COASTAL_SPREAD_MS`(22s) 동안 spread 0.3→1.0

> 실제 CFD/조석 모델이 아닌 **교육 연출용 단순 모델**이다.

### 3.3 run-up geometry (`buildSurgeFan`)

해안 **region**(east/south/west) 기준으로 바다→육지 방향을 결정한다.

```
[바다] ← sea edge (고정, 해안선에서 ~2km offshore)
         ↕ wedge (spread에 따라 육지 전선만 전진)
[해안선] ← shorePoint (도시 중심에서 바다 방향 ~3.2km)
         ↕
[육지] ← inland front (spread ↑)
```

- **바다쪽 변**: spread와 무관하게 고정
- **육지쪽 전선**: `spreadFactor`에 비례해 안쪽으로 확장
- **갱신 주기**: 80ms마다 summary 계산, geometry는 `getRunupStateKey()`로 양자화해 **변경 시에만** primitive 교체 (깜빡임 방지)

---

## 4. UI / UX (현재)

### 4.1 좌측 패널 (`TsunamiMainUI`)

- 진원 프리셋: 동해 근해 / 서해 / 일본 서부 + 지도 클릭 지정
- 파면 설정: 최대 파고, 최대 전파 거리
- 피해 범위: 파면 반경, 추정 면적, 영향 연안 수, 최대 파고

### 4.2 카메라

| 시점 | 동작 |
|------|------|
| 시뮬 시작 | `flyToBoundingSphere` + `HeadingPitchRange` → **진원이 화면 중앙** |
| "연안 조망" 버튼 | 진원·연안 centroid 기준 광역 조망 |

> `flyTo({ destination, pitch })`만 쓰면 look-at이 어긋나 진원이 화면 아래로 밀리는 문제가 있어 **BoundingSphere + offset** 방식으로 수정됨.

### 4.3 상태바

- `전파 중` / `피해 연안 N곳` 등 simState·impactSummary 연동

---

## 5. 개발 중 해결한 이슈

| # | 증상 | 원인 | 해결 |
|---|------|------|------|
| 1 | 피해 UI만 있고 물/애니메이션 없음 | run-up 레이어 미구현 | `TsunamiRunupPrimitiveLayer` 추가 |
| 2 | 사각형·슬래브 형태 | quad geometry, 가로 폭 과다 | curved fan polygon으로 교체 |
| 3 | ring/ellipse 깜빡임 | Entity 매 프레임 재생성 | Primitive + state key 양자화 |
| 4 | `semiMajorAxis >= semiMinorAxis` | 타원 축 swap 누락 | (fan 전환 후 해당 경로 축소) |
| 5 | GroundPrimitive 렌더 크래시 | `createGeometry()` 결과를 전달 | `PolygonGeometry` 정의를 직접 전달 |
| 6 | 육지 한가운데 물 생성 | 진원 방향 + 도시 중심 앵커 | **region 기반 해안선 앵커** + offshore sea edge |
| 7 | 카메라·진원 불일치 | pitch-only flyTo | `flyToBoundingSphere` + HPR |

---

## 6. 알려진 한계 · 남은 작업

### 6.1 시각화

- [ ] **실제 해안선 데이터 미사용** — region + 고정 오프셋(m)으로 해안 위치 추정. 포항 등 일부 도시에서 wedge 위치가 실제 만/항과 어긋날 수 있음
- [ ] **바다 위 overlay 가시성** — `GroundPrimitive`는 지형에 붙음. 바다 구간은 bathymetry/수면과 겹쳐 육지 부분만 두드러져 보일 수 있음
- [ ] **연안 마커 위치** — 여전히 **도시 중심** 좌표. 침수 wedge는 해안선 기준
- [ ] **OSM 건물 침수** — Phase 3a 미착수 (토글만 존재)
- [ ] **camera shake / 타임라인 UI** — Phase 3b 미착수

### 6.2 모델

- [ ] `estimatedAreaKm2` = πr² 단순 원 면적 — 실제 해안 피해 면적과 다름 (교육용 근사)
- [ ] spread 최소값 0.3 — 도달 직후에도 inland front가 어느 정도 들어와 있음

### 6.3 문서·코드 정리

- [ ] `docs/tsunami-phase1.md`, `docs/features.md` 일부가 **구 설계(강남 침수)** 를 아직 언급
- [ ] `FloodSurgeMask` (`floodWaterMesh.js`) — 초기 실험 잔재, 쓰나미 run-up에서 미사용
- [ ] **Git 미커밋** — `src/modules/tsunami/`, `TsunamiWaveModel.*` 등 전체가 untracked/modified 상태

---

## 7. 테스트 현황

```bash
npm test -- --run   # 35 passed (7 files)
npm run build       # 성공
```

| 파일 | 테스트 내용 |
|------|-------------|
| `TsunamiWaveModel.test.js` | ring, 도달, 파고 ramp, spread |
| `coastalSurgeLayout.test.js` | sea anchor가 도시 동쪽(동해), surge mask |
| `tsunamiRunupSites.test.js` | fan 꼭짓점 수, sea edge 고정, spread 전진, east coast 방향 |

---

## 8. 파일별 Git 상태 (2026-05-23)

**신규 (untracked)**

- `src/modules/tsunami/` (전체)
- `src/physics/TsunamiWaveModel.js`
- `src/physics/TsunamiWaveModel.test.js`
- `docs/tsunami-phase1.md`

**수정 (modified, 커밋 대기)**

- `src/utils/floodWaterMaterial.js` — 쓰나미 색조 톤다운
- `src/utils/floodWaterMesh.js` — FloodSurgeMask 타입 추가
- `src/modules/registry.js` — tsunami `available: true`
- `docs/goals.md`, `docs/features.md`, `docs/README.md` 등

---

## 9. 로드맵 대비 진행률

[goals.md](./goals.md) 기준 Phase 매핑:

| Phase | 기획 내용 | 현재 |
|-------|-----------|------|
| **Phase 1** | 진원 UI + ring + 타임라인 + 카메라 | ✅ **완료** |
| **Phase 2** | 방향성 전파, 해안 run-up | 🟡 **부분 완료** — run-up wedge·region 방향 구현, 해안선 정밀화·수면 표현 남음 |
| **Phase 3a** | OSM 건물 침수 shader | ❌ 미착수 |
| **Phase 3b** | camera shake, UI 타임라인 | ❌ 미착수 |
| **Phase 4** | splash/debris | ❌ 미착수 |

---

## 10. 다음 권장 작업 (우선순위)

1. **브라우저 QA** — 동해 프리셋 실행 후 포항·울산 wedge가 **바다→육지**로 보이는지 확인
2. **해안선 정밀화** — OpenStreetMap coastline 또는 수동 shore anchor per city
3. **문서 동기화** — `tsunami-phase1.md` §방향 전환 반영, `features.md` 쓰나미 섹션 갱신
4. **Git 커밋** — 쓰나미 모듈 1차 묶음 커밋
5. **Phase 2 마무리** — 바다 구간 수면 tint, spread=0 근처 thin wedge 연출
6. **Phase 3a** — OSM 건물 Classification 침수 (선택)

---

## 11. 로컬 실행

```bash
npm install
npm run dev        # http://localhost:5173
# 쓰나미 탭 → 진원 "동해 근해" → 시작
```

필수 env: `.env`에 `VITE_CESIUM_TOKEN` (Cesium Ion)

---

## 12. 변경 이력 (이 문서)

| 날짜 | 내용 |
|------|------|
| 2026-05-23 | 초판 — Phase 1 완료, run-up 튜닝·GroundPrimitive 수정·region 기반 surge 반영 |
