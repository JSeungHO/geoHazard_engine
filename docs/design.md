# 디자인 가이드

GeoHazard Engine의 UI 원칙, 레이아웃, 디자인 토큰을 정리한 문서입니다.
마지막 갱신: 2026-11-06

---

## 원칙

GIS·관제용 운영 도구의 톤을 따릅니다. 장식보다 정보 밀도와 판독성을 우선합니다.

1. **평평한 계층**: 카드 안에 카드를 넣지 않습니다. 섹션은 1px 구분선과 작은 섹션 라벨로 나눕니다.
2. **단일 강조색**: 상호작용 요소에만 `--accent`를 씁니다. 위험·경고 색은 데이터 상태를 표시할 때만 씁니다.
3. **수치 정렬**: 라벨은 왼쪽, 값은 오른쪽에 둡니다. 숫자는 `tabular-nums`로, 좌표는 고정폭 서체로 표기합니다.
4. **표준 범례**: 진도 색은 USGS ShakeMap 표준 색상표(`MMI_COLORS`)를 따르고, 지도 위에 범례를 항상 표시합니다.
5. **이모지 금지**: 아이콘은 [lucide-react](https://lucide.dev) SVG만 사용합니다.
6. **모델 한계 명시**: 앱 바에 "교육용 단순화 모델"을 상시 표시하고, 근사값에는 근거를 함께 적습니다.

---

## 레이아웃

```
┌──────────────────────────────────────────────────────────────────┐
│ ≋ GeoHazard Engine │ 도시 침수 · 지진동            ⓘ 교육용 모델 │  App bar 44px
├────────────────┬─────────────────────────────────────────────────┤
│ Panel 320px    │ Cesium 지도                        ┌──────────┐ │
│ ┌ 제목·위치 ──┐ │                                    │ 레이어   │ │  플로팅
│ │      초기화 │ │                                    └──────────┘ │
│ ├ SECTION ────┤ │                                                 │
│ │ ...         │ │                                    ┌──────────┐ │
│ ├ SECTION ────┤ │                                    │ MMI 범례 │ │  지진 모듈
│ │ ...         │ │                                    └──────────┘ │
│ ├ footer ─────┤ ├─────────────────────────────────────────────────┤
│ │ 재생 컨트롤 │ │ 위도 · 경도 · 지표고 · 카메라        ● 모듈 상태 │  Status bar 28px
└────────────────┴─────────────────────────────────────────────────┘
```

| 영역 | 파일 | 역할 |
|------|------|------|
| 앱 바 | `components/ModuleShell.jsx` | 브랜드, 모듈 전환 탭, 모델 고지 |
| 제어 패널 | `components/ui/Panel.jsx` | 헤더(제목·위치·초기화) / 스크롤 본문 / 고정 푸터 |
| 레이어 컨트롤 | `components/SceneLayersPanel.jsx` | 지도 우상단 플로팅, 접기 가능 |
| 진도 범례 | `modules/earthquake/components/MmiLegend.jsx` | 지도 우하단, I~X+ |
| 상태 바 | `components/MapStatusBar.jsx` | 커서 좌표·고도, `status` prop으로 모듈 상태 |

**레이아웃 주의**
- Cesium canvas는 viewport 전체로 그려질 수 있으므로 `useMapLayout`으로 컨테이너 크기를 px로 고정하고 `viewer.resize()`를 호출합니다.
- 지도 위 오버레이는 모두 지도 컨테이너 안에 `position: absolute`로 렌더합니다(포털 미사용).
- 가로 1000px 미만에서는 `MobileWarning`이 전체 화면을 덮습니다.

---

## 디자인 토큰 (`src/index.css`)

### 표면·선·텍스트

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--bg-app` | `#0b0e12` | 앱 배경, 앱 바 |
| `--bg-panel` | `#111419` | 제어 패널 |
| `--bg-raised` | `#171b21` | 버튼, 호버 행 |
| `--bg-inset` | `#0d1014` | 세그먼트 컨트롤 바탕 |
| `--bg-overlay` | `rgb(17 20 25 / .94)` | 지도 위 플로팅 요소 |
| `--line` / `--line-strong` | `#222730` / `#2e343e` | 구분선 / 컨트롤 테두리 |
| `--text-1` ~ `--text-4` | `#e3e6ea` → `#4b515b` | 본문 → 비활성 |

### 강조·의미

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--accent` | `#3d8bfd` | 주요 버튼, 선택 상태, 슬라이더 |
| `--warning` | `#f5a524` | 경고 알림, 여진 상태 |
| `--danger` | `#e5484d` | 흔들림 감지, 오류 |
| `--data-pwave` / `--data-swave` | `#5eb1ef` / `#f5a524` | P파·S파 표식 |
| `--data-water` | `#4c9aff` | 침수 깊이 슬라이더 |

### 서체

| 토큰 | 값 |
|------|-----|
| `--font-sans` | Pretendard Variable (jsDelivr CDN) |
| `--font-mono` | JetBrains Mono (Google Fonts) — 좌표, 시계 |
| 크기 | `--fs-xs` 11 · `--fs-sm` 12 · `--fs-md` 13(본문) · `--fs-lg` 15(패널 제목) |

---

## UI 요소

`src/index.css`에 정의된 공통 클래스와 `src/components/ui/`의 React 컴포넌트를 조합해 화면을 만듭니다. 모듈별 CSS에는 레이아웃과 해당 모듈 전용 요소만 둡니다.

| 클래스 / 컴포넌트 | 용도 |
|-------------------|------|
| `Panel` (`.panel`) | 모듈 제어 패널 |
| `CollapsibleSection` (`.section`) | 접이식 섹션, `aside`로 헤더 우측 요약값, `nested`로 하위 그룹 |
| `Field` (`.field`) | 라벨·값·슬라이더·범위·힌트 묶음 |
| `Slider` (`.slider`) | 진행 채움 트랙(`--fill`), `color`로 계열 색 지정 |
| `SwitchRow` (`.switch-row`) | 라벨 + 토글 스위치 |
| `.btn` | `--primary` · `--ghost` · `--active` · `--block` · `--lg` |
| `.segmented` | 프리셋 전환 (잔잔/보통/폭풍) |
| `.option-list` / `.option-row` | 시나리오·진원 프리셋 라디오 목록, 우측 `__meta`에 핵심 수치 |
| `.kv` | 수치 그리드 (2열 기본, `--4`, `__cell--span2`) |
| `.tag` | 작은 속성 표시 (관측 연도, 가상, 배속) |
| `.notice` | 인라인 알림 (`--warning`, `--danger`) |
| `.overlay-surface` | 지도 위 플로팅 표면 |

---

## 진도(MMI) 색상

`src/physics/EarthquakeWaveModel.js`의 `MMI_COLORS`는 USGS ShakeMap 표준 색상표입니다. 지도 진도 레이어, OSM 건물 손상색, 도시 마커, 패널 표, 범례가 모두 같은 값을 씁니다.

| I | II | III | IV | V | VI | VII | VIII | IX | X+ |
|---|----|-----|----|---|----|-----|------|----|----|
| `#FFFFFF` | `#BFCCFF` | `#A0E6FF` | `#80FFFF` | `#7AFF93` | `#FFFF00` | `#FFC800` | `#FF9100` | `#FF0000` | `#C80000` |

## 시간 표기

지진 모듈은 `timeScale` 배속(기본 ×50)으로 애니메이션합니다. 패널의 도달 시간, 경과 시계(`T+mm:ss`), 스크럽 바 라벨은 모두 **물리 시간**(애니메이션 시간 × 배속)으로 표기하고, 배속은 `.tag`로 따로 표시합니다.

---

## 수면·강수 비주얼

| 항목 | 스펙 |
|------|------|
| 수면 베이스 | 하늘색 `#96D7FA` 계열, 반투명 |
| 반사 | Fresnel 하늘 거울 반사 (`reflectivity`) |
| glint | 태양 broad + crest + fine ripples (`glintStrength`) |
| 강수 파티클 | 세로 streak, `rgba(200, 230, 255)`, gravity `-280` |

---

## 관련 문서

- [구현 기능](./features.md): 렌더링·시뮬레이션 상세
- [작업 목표](./goals.md): 로드맵·다음 모듈
