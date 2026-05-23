# 디자인 가이드

GeoHazard Engine UI·레이아웃·비주얼 토큰 정리.

> UX 개선 백로그: [기획·테스트 평가](./evaluation.md) §3 · 우선순위는 [작업 목표](./goals.md) 로드맵 참고.

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

**모바일 (U-8)**: 320px + 280px 고정으로 **1000px 미만** 레이아웃 파괴. 단기 — 768px 이하 "데스크탑 이용" 안내. 장기 — 반응형 개편.

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
- **건물 침수색**: 현재 미적용 (연출-only collapse/coloring은 향후 모듈에서 검토)

## UX 개선 백로그

[evaluation.md §3](./evaluation.md#3-ux--제품-문제) 전체 목록. 아래는 디자인 관점 요약.

### 🔴 HIGH — 제품 완성도

| ID | 문제 | 개선 방향 |
|----|------|-----------|
| U-1 | **온보딩 없음** — 앱 목적·슬라이더 의미 불명 | 첫 방문 Welcome 오버레이 1장 |
| U-2 | **슬라이더 단위 불명확** — `3.50 m`, `72%` 의미 모호 | 저지대 대비 m, mm/h 환산 힌트 |
| U-3 | **초기화 버튼 없음** — 수위 100m 후 원복 어려움 | 헤더/푸터 `초기화` 1클릭 |

### 🟡 MEDIUM

| ID | 문제 | 개선 방향 |
|----|------|-----------|
| U-4 | 시뮬 옵션이 개발자 용어 (`waveStiffness` 등) | 프리셋(잔잔/보통/폭풍) 또는 직관적 레이블 |
| U-5 | 상태바가 경위도·고도만 표시 | `침수 셀 수`, `침수선 대비 표고` 등 재난 문맥 정보 |
| U-6 | 지형 async 샘플링 중 피드백 없음 | `🔄 지형 정밀화 중...` 배지 |
| U-7 | 프리셋 시나리오 없음 | "2022 강남 침수" 등 드롭다운 |
| U-8 | 모바일 미지원 | 단기 안내 → 장기 반응형 |

### 슬라이더 UX 스펙 (U-2 목표)

**수위 슬라이더** (현재: `수위: X.XX m`):

```
수위: 3.50 m
💧 저지대 대비 +3.5 m (지하철 1층 ≈ 5 m)
```

**강수 슬라이더** (현재: `강수: XX%`):

```
강수: 72%
≈ 약 130 mm/h (호우경보 기준 참고)
```

### Welcome 오버레이 (U-1 목표)

- **제목**: 강남역 침수 시뮬레이션
- **본문**: 강수량을 올리고 수위를 조절해 침수 범위를 확인하세요
- **CTA**: "시작하기" → localStorage로 재표시 방지
- **위치**: 지도 위 반투명 카드, 사이드바는 그대로 노출

### 초기화 버튼 (U-3 목표)

한 번에 리셋:

- 강수 0%, 수위 0 m
- 자동 상승 OFF
- 시뮬 옵션 → `simulationDefaults.js` 기본값

## 관련 문서

- [기획·테스트 평가](./evaluation.md) — UX·버그 상세
- [구현 기능](./features.md) — Cesium 렌더링·시뮬레이션
- [작업 목표](./goals.md) — UX 항목 스프린트 배치
