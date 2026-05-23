# 디자인 가이드

GeoHazard Engine UI·레이아웃·비주얼 토큰 정리.  
마지막 갱신: 2026-05-24

---

## UI 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ ModuleShell 탭 (홍수 · 쓰나미[준비중] · 지진[준비중]) │
├──────────────┬───────────────────────┬───────────────┤
│ FloodMainUI  │     Cesium 지도       │  SceneLayers  │
│   (320px)    │                       │   (280px)     │
│              │  [WelcomeOverlay]     │               │
│              │  [TerrainLoadingBadge]│               │
│              │  ─────────────────── │               │
│              │  [MapStatusBar]       │               │
└──────────────┴───────────────────────┴───────────────┘
```

| 영역 | 파일 | 역할 |
|------|------|------|
| 탭 네비 | `ModuleShell.jsx` | 재난 모듈 전환 탭 |
| 좌측 | `FloodMainUI.jsx` | 시나리오·강수·수위·시뮬 옵션·초기화 |
| 중앙 | `FloodModule` + `useMapLayout.js` | Cesium viewer, canvas px 리사이즈 |
| 우측 | `SceneLayersPanel.jsx` | 레이어 토글 (`fixed right:0`) |
| 지도 오버레이 | `WelcomeOverlay`, `TerrainLoadingBadge` | 첫 방문 안내, 로딩 표시 |
| 지도 하단 | `MapStatusBar.jsx` | 경위도·고도·침수 상태 |

**레이아웃 주의**:  
- Cesium canvas는 viewport 전체로 그려질 수 있음 → `useMapLayout`으로 컨테이너 px 고정 + `viewer.resize()` 필수  
- 좌측 사이드바 `z-index: 1000` — canvas와 겹침 방지  
- **1000px 미만**: `MobileWarning` 전체화면 차단 (닫기 불가, resize 해제)

---

## 컬러 팔레트

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-bg` | `#0F172A` | 배경 |
| `--color-primary` | `#38BDF8` | 강수·파도·활성 버튼 |
| `--color-danger` | `#F43F5E` | 수위·침수·위험 |
| `--color-text` | `#F1F5F9` | 기본 텍스트 |
| `--color-text-muted` | text 55% | 보조 텍스트 |
| `--color-text-subtle` | text 40% | 힌트·설명 |
| `--color-surface` | text 4% | 카드·버튼 배경 |
| `--color-surface-hover` | text 8% | 호버 상태 |
| `--color-border` | text 10% | 테두리 |
| `--color-primary-dim` | primary 18% | 활성 버튼 배경 |
| `--color-primary-border` | primary 45% | 활성 버튼 테두리 |

---

## 사이드바 구성 (FloodMainUI)

```
┌────────────────────────────────┐
│ GeoHazard Engine    [초기화]   │  ← 헤더
│ 강남역 침수 · 강수 시뮬레이션  │
├────────────────────────────────┤
│ 📋 시나리오              ▲    │  ← defaultOpen
│   [소나기] [집중호우]          │
│   [2022 강남역] [태풍급]       │
├────────────────────────────────┤
│ 강수                    80%  ▲│
│   ━━━━━━━━●━━━━━━━━━━━━━━━━  │
│   ≈ 144 mm/h (교육용 근사치)  │
│   [자동 수위 상승 ON]          │
├────────────────────────────────┤
│ 수위                  8.50 m ▲│
│   ━━━━━━━━━━━━━━━●━━━━━━━━━  │
│   저지대 대비 +8.5 m          │
│   (지하철 1층 수준)            │
├────────────────────────────────┤
│ 시뮬레이션 옵션          ▶    │  ← defaultClosed
│   [잔잔] [보통] [폭풍]        │  ← 프리셋 버튼
│   수위 상승 ▶                 │
│   파도      ▶                 │
│   반사/빛   ▶                 │
├────────────────────────────────┤
│ 강수  80%  │  수위  8.50 m    │  ← 푸터 요약
└────────────────────────────────┘
```

---

## MapStatusBar

```
경위도  37.49750°N, 127.02670°E  │  카메라 고도  312.5 m  │  지표 고도  10.3 m  │  💧 8.50 m
```

- **경위도**: 마우스 위치 (마우스 없으면 `—`)
- **카메라 고도**: 실시간 업데이트 (`--color-primary`)
- **지표 고도**: 마우스 아래 terrain 높이 (`--color-danger`)
- **💧 침수**: `waterLevel > 0`일 때만 표시, 우측 끝 정렬 (`margin-left: auto`)

---

## 수면·강수 비주얼

| 항목 | 스펙 |
|------|------|
| 수면 베이스 | 하늘색 `#96D7FA` 계열, 반투명 |
| 반사 | Fresnel 하늘 거울 반사 (`reflectivity`) |
| glint | 태양 broad + crest + fine ripples (`glintStrength`) |
| 강수 파티클 | 세로 streak, `rgba(200, 230, 255)`, gravity `-280` |
| 건물 침수색 | 미적용 — 쓰나미 Phase 3a에서 검토 |

---

## 레이어 패널 (SceneLayersPanel)

| 파일 | 역할 |
|------|------|
| `src/constants/sceneLayers.js` | 레이어 정의 (`SCENE_LAYER_DEFS`) |
| `src/scene/sceneLayerRuntime.js` | load/setVisible/destroy |
| `src/components/SceneLayerController.jsx` | viewerRef + 가시성 → Cesium 객체 |

현재 레이어: **OSM 건물** (`createOsmBuildingsAsync`) — 기본 ON.

---

## 공통 컴포넌트

| 컴포넌트 | 위치 | 용도 |
|----------|------|------|
| `CollapsibleSection` | `components/` | 접이식 패널 섹션 (nested 지원) |
| `MapStatusBar` | `components/` | 지도 하단 상태, `waterLevel` prop |
| `ModuleShell` | `components/` | 재난 모듈 탭 네비 |
| `MobileWarning` | `components/` | 1000px 미만 차단 오버레이 |
| `SimulationErrorBoundary` | `components/` | Cesium 오류 격리, 재시도 버튼 |
| `WelcomeOverlay` | `modules/flood/components/` | 첫 방문 온보딩 |
| `TerrainLoadingBadge` | `modules/flood/components/` | 지형 샘플링 로딩 배지 |
| `ScenarioPanel` | `modules/flood/components/` | 프리셋 시나리오 버튼 목록 |

---

## 관련 문서

- [구현 기능](./features.md) — 렌더링·시뮬레이션 상세
- [작업 목표](./goals.md) — 로드맵·다음 모듈
- [성능 2차 기획서](./perf-phase2.md) — P-1~P-5
