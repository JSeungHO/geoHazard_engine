# UX 개선 구현 결과

> 기획 문서: [ux-backlog.md](./ux-backlog.md)  
> 구현일: 2026-05-24  
> 대상 브랜치: `dev`

[ux-backlog.md](./ux-backlog.md)에 정의된 **U-4, U-5, U-7, U-8** 4개 항목을 구현했다.

---

## 구현 요약

| ID | 항목 | 상태 | 핵심 변경 |
|----|------|------|-----------|
| U-8 | 모바일 경고 | ✅ | `MobileWarning` — 1000px 미만 전체 화면 차단 |
| U-5 | 상태바 침수 표시 | ✅ | `MapStatusBar` — `waterLevel` pill, 레이블 `지표 고도` |
| U-4 | 시뮬레이션 프리셋 | ✅ | `WAVE_PRESETS` + `SimulationOptions` 3버튼 |
| U-7 | 프리셋 시나리오 | ✅ | `scenarios.js` + `ScenarioPanel` 사이드바 상단 |

---

## U-8 — 모바일 경고

### 구현

- **신규**: `src/components/MobileWarning.jsx`, `MobileWarning.css`
- **수정**: `src/App.jsx` — `ModuleShell` 위에 `<MobileWarning />` 배치

### 동작

- `window.innerWidth < 1000` → 전체 화면 경고 (닫기 불가)
- `resize` 이벤트로 1000px 이상 복귀 시 자동 해제
- `z-index: 9999` — 모든 UI 위에 표시

---

## U-5 — 상태바 재난 문맥

### 구현

- **수정**: `src/components/MapStatusBar.jsx`, `MapStatusBar.css`
- **수정**: `src/modules/flood/FloodModule.jsx` — `waterLevel` prop 전달

### 동작

- `표고` → **`지표 고도`** 레이블 변경
- `waterLevel > 0`일 때 우측에 `💧 X.XX m` 침수 pill (`margin-left: auto`)
- `waterLevel = 0`이면 pill 숨김

---

## U-4 — 시뮬레이션 옵션 프리셋

### 구현

- **수정**: `src/modules/flood/constants/simulationDefaults.js`
  - `WAVE_PRESETS` (잔잔 / 보통 / 폭풍)
  - `matchesSimulationPreset`, `findActivePresetId` 헬퍼
- **수정**: `SimulationOptions.jsx`, `SimulationOptions.css` — 프리셋 버튼 바
- **수정**: `FloodMainUI.jsx`, `FloodModule.jsx` — `onPresetApply` → `setSimulationOptions(values)` atomic update

### 프리셋 값

| 프리셋 | waterRiseSpeed | waveTimeScale | waveMaxAmplitude | 특징 |
|--------|----------------|---------------|------------------|------|
| 잔잔 | 0.12 | 0.12 | 1.8 m | 낮은 파동·반사 강조 |
| 보통 | 0.24 | 0.32 | 4.2 m | `DEFAULT_SIMULATION_OPTIONS` |
| 폭풍 | 0.60 | 0.75 | 8.0 m | 높은 파고·강한 glint |

### active 감지

- 현재 `options`가 프리셋 `values`와 **모든 키 일치** (ε = 1e-4) → 해당 버튼 active
- 슬라이더 수동 조정으로 어긋나면 active 해제

### 테스트

- `simulationDefaults.test.js` — preset match / `findActivePresetId`

---

## U-7 — 프리셋 시나리오

### 구현

- **신규**: `src/modules/flood/constants/scenarios.js`
- **신규**: `ScenarioPanel.jsx`, `ScenarioPanel.css`
- **수정**: `FloodMainUI.jsx` — 강수 섹션 **위**에 `📋 시나리오` (defaultOpen)
- **수정**: `FloodModule.jsx` — `handleScenarioApply` → rain / water / autoRise 일괄 세팅

### 시나리오 목록

| ID | 라벨 | 강수 | 수위 | 자동상승 |
|----|------|------|------|----------|
| drizzle | 소나기 | 40% | 0 m | ON |
| heavy_rain | 집중호우 | 75% | 3.5 m | ON |
| gangnam_2022 | 2022 강남역 | 85% | 8.5 m | OFF |
| typhoon | 태풍급 | 100% | 15 m | ON |

---

## 변경 파일 목록

```
src/
├── App.jsx
├── components/
│   ├── MapStatusBar.jsx / .css
│   ├── MobileWarning.jsx / .css          (신규)
└── modules/flood/
    ├── FloodModule.jsx
    ├── constants/
    │   ├── simulationDefaults.js         (+ WAVE_PRESETS)
    │   ├── simulationDefaults.test.js    (신규)
    │   └── scenarios.js                  (신규)
    └── components/
        ├── FloodMainUI.jsx
        ├── SimulationOptions.jsx / .css
        ├── ScenarioPanel.jsx / .css      (신규)
docs/
└── ux-implementation.md                  (본 문서)
```

---

## 수동 QA 체크리스트

- [ ] 1000px 미만 창 → 모바일 경고 표시, 1000px 이상 → 앱 정상
- [ ] 수위 0 → 상태바 침수 pill 없음 / 수위 > 0 → `💧 X.XX m` 표시
- [ ] 프리셋 **폭풍** 클릭 → 파도·반사 값 변경, 버튼 active
- [ ] 프리셋 적용 후 슬라이더 조정 → active 프리셋 해제
- [ ] **2022 강남역** 시나리오 → 강수 85%, 수위 8.5m, 자동상승 OFF
- [ ] **초기화** → 시나리오·프리셋 포함 전체 리셋

---

## 관련 문서

- [UX 개선 기획서](./ux-backlog.md) — 기획 원본
- [기획·테스트 평가](./evaluation.md) — U-4~U-8 문제 정의
- [디자인 가이드](./design.md) — 레이아웃·토큰
