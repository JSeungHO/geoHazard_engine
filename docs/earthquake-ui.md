# GeoHazard Engine — 지진 모듈 UI 기획서

> 작성일: 2026-05-24  
> 대상 브랜치: `dev`  
> 상태: **기획 중**  
> 참조: [earthquake-plan.md](./earthquake-plan.md), [design.md](./design.md)

---

## 1. 전체 레이아웃

기존 모듈과 동일한 ModuleShell 구조를 따른다.

```
┌─────────────────────────────────────────────────────────────┐
│  [홍수·침수]  [쓰나미]  [지진 ●]                            │  ← 탭 nav
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│ EarthquakeMainUI  │       Cesium 지도 (지형 + OSM 건물)      │
│   (320px)     │                                             │
│               │   [P파 ring — 흰 점선]                      │
│  ▼ 진원 설정  │   [S파 ring — 주황 실선]                    │
│  ▼ 지진 설정  │   [진앙 마커]                               │
│  ▼ 피해 범위  │   [도시 마커 + MMI 라벨]                    │
│  ▼ 시뮬레이션 │                                             │
│               │                [MapStatusBar]               │
└───────────────┴─────────────────────────────────────────────┘
```

- 좌측 사이드바: **320px**, `z-index: 1000`
- 지도 영역: `flex: 1`
- 우측 SceneLayersPanel: 공용 컴포넌트 (건물 토글)

---

## 2. 사이드바 구조 (`EarthquakeMainUI.jsx`)

### 헤더

```
🌍 지진 — 지진파 전파·진도 분포               [초기화 ↺]
```

- 제목 앞 이모지: `🌍`
- 우측: 초기화 버튼 (`earthquake-main-ui__reset`)
- 홍수/쓰나미와 동일한 `flood-main-ui__header` 패턴 참조

---

### 섹션 1 — 진원 설정

```
▼ 진원 설정
┌─────────────────────────────────────────┐
│  [경주 2016]  [포항 2017]  [양산단층]   │  ← 프리셋 버튼 (2×3 그리드)
│  [서해 해역]  [동해 해역]               │
│                                         │
│  위도  35.76°  경도  129.19°            │  ← 선택된 진원 좌표
│  깊이  15 km   규모  M 5.8             │  ← 선택된 진원 속성
│                                         │
│  [📍 지도에서 선택]                      │  ← pick 버튼
└─────────────────────────────────────────┘
```

**버튼 상태**:
- 기본: `earthquake-main-ui__preset`
- 활성: `earthquake-main-ui__preset--active` (`--color-primary-dim` 배경)
- 비활성(사용자 지도 클릭 후): 모든 프리셋 비활성

**지도 선택 버튼**:
- 기본: `earthquake-main-ui__pick`
- 선택 모드 중: `earthquake-main-ui__pick--active` (테두리 강조)
- 선택 완료 후 자동 비활성화

**좌표 / 속성 표시**:
```jsx
<div className="earthquake-main-ui__coords">
  <span>위도 {lat.toFixed(2)}°</span>
  <span>경도 {lon.toFixed(2)}°</span>
</div>
<div className="earthquake-main-ui__attrs">
  <span>깊이 {depthKm} km</span>
  <span>규모 M {magnitude.toFixed(1)}</span>
</div>
```

---

### 섹션 2 — 지진 설정

```
▼ 지진 설정
┌─────────────────────────────────────────┐
│  규모 (M)                    6.0        │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●     │
│  4.0                           8.0      │
│                                         │
│  진원 깊이                   10 km      │
│  ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●     │
│  1 km                          60 km    │
└─────────────────────────────────────────┘
```

| 슬라이더 | min | max | step | 기본값 |
|---------|-----|-----|------|--------|
| 규모 (M) | 4.0 | 8.0 | 0.1 | 6.0 |
| 진원 깊이 | 1 | 60 | 1 | 10 |

**규모 값에 따른 힌트 텍스트**:
```
M 4.0~4.9  → "소규모 — 일부 지역 약한 흔들림"
M 5.0~5.9  → "중규모 — 건물 피해 가능"
M 6.0~6.9  → "대규모 — 광범위한 피해"
M 7.0+     → "초대규모 — 대규모 재난"
```

**CSS 클래스**:
```
earthquake-main-ui__field          ← label 래퍼
earthquake-main-ui__field-label    ← 이름 + 현재값
earthquake-main-ui__hint           ← 규모 힌트 텍스트 (회색)
```

---

### 섹션 3 — 피해 범위

시뮬레이션 실행 전: 빈 상태 (`아직 시뮬레이션 전입니다` 힌트)  
시뮬레이션 실행 후: 실시간 수치 갱신

```
▼ 피해 범위
┌─────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐             │
│  │ P파 반경 │  │ S파 반경 │             │  ← 2칸 그리드
│  │ 245 km  │  │ 143 km  │             │
│  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐             │
│  │ 영향 도시│  │ 최대 진도│             │
│  │   7 / 12 │  │  MMI VII │             │
│  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐             │
│  │ 추정 면적│  │ 추정 인구│             │  ← Phase 2 추가
│  │ 64k km² │  │ 약 8.2M명│             │
│  └──────────┘  └──────────┘             │
│  중진 이상(MMI VI+) 3개 도시 · OSM 건물 손상색 표시
│  [🟡 경주   MMI VII  P 4s  S 7s  ]      │  ← 도시별 리스트
│  [🟠 포항   MMI VI   P 5s  S 8s  ]
│  [⚪ 서울   MMI III  P 22s S 38s ]
└─────────────────────────────────────────┘
```

**6칸 그리드 값** (Phase 2):
| 칸 | 내용 | idle 시 |
|----|------|---------|
| P파 반경 | `pWaveRadiusKm` | `—` |
| S파 반경 | `sWaveRadiusKm` | `—` |
| 영향 도시 | S파 도달 / 전체 | `—` |
| 최대 진도 | S파 도달 도시 중 max MMI | `—` |
| 추정 면적 | `π × sWaveRadiusKm²` | `—` |
| 추정 인구 | 도시 인구 × MMI 노출 가중치 합 | `—` |

**지도 시각 (Phase 2~3)**:
- MMI overlay: `earthquakeMMILayer.js` — S파 도달 영역 컬러맵
- OSM 건물: `earthquakeBuildingEffects.js` — 손상색 + running 중 vertex 흔들림 (레이어 ON 필요)

**4칸 그리드 값** (Phase 1, superseded):
| 칸 | 내용 | idle 시 |
|----|------|---------|
| P파 반경 | `getRingRadius(elapsed)` km | `—` |
| S파 반경 | `getSWaveRadius(elapsed)` km | `—` |
| 영향 도시 | S파 도달 도시 수 / 전체 | `0 / 12` |
| 최대 진도 | S파 도달 도시 중 최대 MMI | `—` |

**도시 리스트 마커 색상** (MMI 기준):
```
MMI I~III   ⚪ 흰색   (무감~미진)
MMI IV~V    🟡 노랑   (경진~약진)
MMI VI~VII  🟠 주황   (중진~강진)
MMI VIII+   🔴 빨강   (열진 이상)
```

**도시 리스트 항목 표시 조건**:
- S파가 아직 도달하지 않은 도시: 회색 처리 + ETA 표시 (`도달까지 14s`)
- S파 도달한 도시: 색상 마커 + MMI + P파/S파 도달 시간

---

### 섹션 4 — 시뮬레이션

```
▼ 시뮬레이션
┌─────────────────────────────────────────┐
│  [▶ 시작]                               │  ← idle 상태
│  [⏸ 일시정지]  [↺ 초기화]              │  ← running 상태
│  [▶ 재개]      [↺ 초기화]              │  ← paused 상태
│                                         │
│  ┌ SimTimeline ──────────────────────┐  │
│  │ 🕐 00:45    P파 480 km  S파 280 km│  │
│  │                                   │  │
│  │ ● 진원 진동     해저 지진 발생      │  │  ← done
│  │   ████████████████░░░░░ 75%       │  │  ← P파 진행
│  │ ○ P파 전파      12개 도시 도달     │  │  ← 진행중
│  │   ████████░░░░░░░░░░░░░ 45%       │  │  ← S파 진행
│  │ ○ S파 도달      카메라 위치 도달   │  │  ← pending
│  │   ░░░░░░░░░░░░░░░░░░░░░  0%       │  │
│  │ ○ 전파 완료     최대 800 km        │  │  ← pending
│  └───────────────────────────────────┘  │
│                                         │
│  ┌ ScrubBar ────────────────────────┐  │
│  │  ●━━━━━━━━P━━━━━━━━━S━━━━━━━━━━  │  │
│  │  0s    P도달 12s   S도달 21s  60s │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 3. 타임라인 (`EarthquakeSimTimeline`)

쓰나미 `SimTimeline`과 동일한 구조. 단계 4개:

| 단계 | phase | label | sub |
|------|-------|-------|-----|
| 1 | 항상 done | 진원 진동 | 해저/지하 지진 발생 |
| 2 | pwave 진행 | P파 전파 | `{n}개 도시 도달 중` / `전 도시 도달` |
| 3 | swave 진행 | S파 도달 | `카메라 위치 도달` / `{n}개 도시 흔들림` |
| 4 | done 시 | 전파 완료 | `최대 {maxKm} km` |

**헤더 표시값**:
```
🕐 00:45    P파 480 km    S파 280 km
```
- 경과 시간 (초)
- P파 현재 반경 (km)
- S파 현재 반경 (km)

**진행 바 색상**:
| 바 | 색상 | CSS 토큰 |
|----|------|---------|
| P파 진행 | 흰색 반투명 | `--color-text` 50% |
| S파 진행 | 주황 | `#F97316` |
| 흔들림 | 빨강 | `--color-danger` |

**카메라 쉐이크 발동 알림**:
S파가 카메라 위치에 도달하는 순간 타임라인에 한 줄 삽입:
```
⚡ 현재 위치 흔들림 — MMI V
```
- `earthquake-main-ui__shake-alert` 클래스
- 2초간 표시 후 fade out

---

## 4. 스크러빙 바 (`EarthquakeScrubBar`)

쓰나미 `ScrubBar` 패턴 재사용. 마커 2개:

```
  ●━━━━━━━━━━━P━━━━━━━S━━━━━━━━━━━━━━━●
  0s        P최초     S최초           총시간
            도달       도달
```

| 마커 | 의미 | 색상 |
|------|------|------|
| `P` | 첫 도시 P파 도달 시각 | 흰색 |
| `S` | 첫 도시 S파 도달 시각 | 주황 |

```jsx
<div className="scrub-bar__marker scrub-bar__marker--pwave"
     style={{ left: `${pPct}%` }} />
<div className="scrub-bar__marker scrub-bar__marker--swave"
     style={{ left: `${sPct}%` }} />
```

---

## 5. 상태 전환

```
idle
  ↓ [▶ 시작]
running (pwave)
  → P파 ring 확산
  → 도시 P파 도달 시 마커 색상 변경
  ↓ S파 ring 시작
running (swave)
  → S파 ring 확산
  → 카메라 위치 S파 도달 → 카메라 쉐이크
  → 도시 S파 도달 시 MMI 라벨 표시
  ↓ [⏸]
paused
  ↔ [▶ 재개] → running (이어서)
  ↔ ScrubBar 드래그 가능
  ↓ maxPropagation 도달
done
  → 전체 피해 요약 표시 유지
  ↓ [↺ 초기화]
idle
```

**simState 값**: `'idle' | 'running' | 'paused' | 'done'`

---

## 6. 카메라 쉐이크 UX

### 발동 조건
- `simState === 'running'`
- S파 ring이 카메라 위치 반경에 도달한 순간 **1회만**
- 스크러빙(`paused`) 중에는 **발동하지 않음**

### 강도 표시
쉐이크 발동 시 사이드바에 순간 알림:
```
⚡ 현재 위치 흔들림 — MMI V (2초 후 사라짐)
```

### 시각 피드백 (지도)
쉐이크 도중 MapStatusBar pill 색상 변화:
```
평소:  ⬛ 지진 전파 중
쉐이크: 🔴 흔들림 감지 (카메라 위치)
```

---

## 7. CSS 클래스 명명 규칙

모듈 prefix: `earthquake-main-ui__*`  
타임라인: `eq-tl-*` (쓰나미 `tl-*` 와 충돌 방지)  
스크러빙: `scrub-bar__*` (쓰나미와 공유 가능)

| 요소 | 클래스 |
|------|--------|
| 사이드바 최상위 | `earthquake-main-ui` |
| 헤더 | `earthquake-main-ui__header` |
| 초기화 버튼 | `earthquake-main-ui__reset` |
| 프리셋 버튼 | `earthquake-main-ui__preset` |
| 프리셋 활성 | `earthquake-main-ui__preset--active` |
| 지도 선택 버튼 | `earthquake-main-ui__pick` |
| 지도 선택 활성 | `earthquake-main-ui__pick--active` |
| 좌표 표시 | `earthquake-main-ui__coords` |
| 속성 표시 (깊이·규모) | `earthquake-main-ui__attrs` |
| 슬라이더 label | `earthquake-main-ui__field` |
| 슬라이더 레이블 | `earthquake-main-ui__field-label` |
| 힌트 텍스트 | `earthquake-main-ui__hint` |
| 액션 버튼 | `earthquake-main-ui__action` |
| 액션 버튼 주요 | `earthquake-main-ui__action--primary` |
| 4칸 통계 그리드 | `earthquake-main-ui__stats` |
| 통계 카드 | `earthquake-main-ui__stat` |
| 통계 값 | `earthquake-main-ui__stat-value` |
| 통계 라벨 | `earthquake-main-ui__stat-label` |
| 도시 리스트 | `earthquake-main-ui__city-list` |
| 도시 항목 | `earthquake-main-ui__city-item` |
| 도시 항목 도달 | `earthquake-main-ui__city-item--reached` |
| 쉐이크 알림 | `earthquake-main-ui__shake-alert` |
| 타임라인 헤더 | `eq-tl__header` |
| 타임라인 클럭 | `eq-tl__clock` |
| 타임라인 파 반경 | `eq-tl__radius` |
| P파 진행 바 | `eq-tl__bar--pwave` |
| S파 진행 바 | `eq-tl__bar--swave` |

---

## 8. 재사용 컴포넌트 목록

| 컴포넌트 | 출처 | 그대로 재사용 | 비고 |
|----------|------|--------------|------|
| `CollapsibleSection` | 공용 | ✅ | 섹션 4개 모두 |
| `ModuleShell` | 공용 | ✅ | 탭 라우터 |
| `MapStatusBar` | 공용 | ✅ | pill 텍스트만 변경 |
| `SceneLayersPanel` | 공용 | ✅ | OSM 건물 토글 |
| `SimulationErrorBoundary` | 공용 | ✅ | 렌더 오류 격리 |
| `ScrubBar` | tsunami | 🔄 마커 확장 | P·S파 마커 2개 추가 |
| `TimelineStep` | tsunami | ✅ | 4단계로 확장만 |

---

## 9. 구현 파일 목록

```
src/modules/earthquake/
├── EarthquakeModule.jsx
├── EarthquakeModule.css
├── components/
│   ├── EarthquakeVisualization.jsx   ← P·S파 ring + 도시 마커
│   ├── EarthquakeMainUI.jsx          ← 이 문서 기준 사이드바
│   └── EarthquakeMainUI.css
├── constants/
│   ├── earthquakePresets.js          ← 5개 프리셋 + DEFAULT_OPTIONS
│   └── earthquakeImpactCities.js     ← 12개 주요 도시
└── utils/
    ├── cameraShake.js                ← postUpdate 기반 쉐이크
    ├── earthquakeMMILayer.js         ← Phase 2 MMI overlay
    └── earthquakeBuildingEffects.js  ← Phase 3 OSM 손상·흔들림
```

---

## 10. 관련 문서

| 문서 | 용도 |
|------|------|
| [earthquake-plan.md](./earthquake-plan.md) | 물리 모델·Phase 계획·하지 말아야 할 것 |
| [tsunami-phase1.md](./tsunami-phase1.md) | 재사용 패턴 참고 (ring, ScrubBar, 타임라인) |
| [design.md](./design.md) | 컬러 팔레트·레이아웃 토큰 |
| [features.md](./features.md) | 모듈 라우터 구조 |
