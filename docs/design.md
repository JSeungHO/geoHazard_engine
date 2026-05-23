# 디자인 가이드

GeoHazard Engine UI·레이아웃·비주얼 토큰 정리.

## UI 레이아웃

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

**레이아웃 주의**: Cesium canvas는 viewport 전체로 그려질 수 있음 → `useMapLayout`으로 컨테이너 px 고정 + `viewer.resize()` 필수. 좌측 사이드바는 `z-index: 1000`으로 canvas와 겹침 방지.

## 컬러 팔레트

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-bg` | `#0F172A` | 배경 |
| `--color-primary` | `#38BDF8` | 강수·파도·옵션 |
| `--color-danger` | `#F43F5E` | 수위·침수 |
| `--color-text` | `#F1F5F9` | 텍스트 |

## 레이어 패널

우측 `SceneLayersPanel`에서 지도 위 오버레이 레이어를 토글한다.

| 파일 | 역할 |
|------|------|
| `src/constants/sceneLayers.js` | 레이어 정의 (`SCENE_LAYER_DEFS`) |
| `src/scene/sceneLayerRuntime.js` | 레이어별 load/setVisible/destroy |
| `src/components/SceneLayerController.jsx` | viewerRef + 가시성 → Cesium 객체 |

현재 레이어: **OSM 건물** (`createOsmBuildingsAsync`, Cesium Ion) — 기본 ON.

## 공통 UI 컴포넌트

| 컴포넌트 | 용도 |
|----------|------|
| `CollapsibleSection` | 접이식 패널 섹션 |
| `MapStatusBar` | 지도 하단 상태 표시 |
| `RainControl` / `WaterLevelControl` | 강수·수위 슬라이더 |

## 수면·강수 비주얼 (구현 기준)

- **수면**: 하늘색(`#96D7FA` 계열) + Fresnel 하늘 반사 + 태양 glint 3단계
- **강수**: 세로 streak 파티클, 지표 방향 gravity
- **건물 침수색**: 현재 미적용 (연출-only collapse/c coloring은 향후 모듈에서 검토)

## 관련 문서

- [구현 기능](./features.md) — Cesium 렌더링·시뮬레이션 상세
- [작업 목표](./goals.md) — 로드맵·확장 모듈
