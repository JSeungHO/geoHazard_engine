# GeoHazard Engine — UX 개선 기획서

> 작성일: 2026-05-24  
> 작성자: 기획  
> 대상 브랜치: `dev`  
> 참조: [evaluation.md](./evaluation.md) — U-4, U-5, U-7, U-8

> **구현 완료**: [ux-implementation.md](./ux-implementation.md) (2026-05-24)

구현 완료된 항목(B-1~B-8, U-1~U-3, U-6, A-1~A-4)은 이미 반영됨.  
이 문서는 **U-4~U-8 UX 개선**의 상세 기획이다. **U-4, U-5, U-7, U-8은 구현 완료.**

---

## U-4 — 시뮬레이션 옵션 프리셋

### 배경

현재 "시뮬레이션 옵션" 패널은 `waveTimeScale`, `waveStiffness` 등 물리 파라미터를 직접 노출한다. 일반 사용자는 이 값이 뭘 의미하는지 알 수 없다. **프리셋 버튼** 3개로 파라미터를 일괄 세팅하고, 슬라이더는 세부 조정 용도로 남긴다.

### 기획 결정

**패널 최상단에 프리셋 버튼 3개를 가로 배치한다.**  
버튼 클릭 → 모든 옵션 값을 해당 프리셋으로 일괄 교체.  
슬라이더는 그대로 유지 (프리셋 이후 세밀 조정 가능).

```
┌─────────────────────────────────┐
│  시뮬레이션 옵션           ▲   │
│  ┌───────┐ ┌───────┐ ┌───────┐ │
│  │  잔잔  │ │  보통  │ │  폭풍  │ │   ← 프리셋 버튼 (토글형)
│  └───────┘ └───────┘ └───────┘ │
│  ─────────────────────────────  │
│  수위 상승 ▶                    │
│  파도      ▶                    │
│  반사/빛   ▶                    │
└─────────────────────────────────┘
```

### 프리셋 값 정의

파일 위치: `src/modules/flood/constants/simulationDefaults.js`에 추가

```js
export const WAVE_PRESETS = [
  {
    id: 'calm',
    label: '잔잔',
    description: '잔잔한 수면',
    values: {
      waterRiseSpeed: 0.12,
      waveTimeScale: 0.12,
      waveStiffness: 0.08,
      waveMaxAmplitude: 1.8,
      rainImpactStrength: 0.01,
      glintStrength: 0.35,
      reflectivity: 0.65,
    },
  },
  {
    id: 'normal',
    label: '보통',
    description: '기본값',
    values: { ...DEFAULT_SIMULATION_OPTIONS },  // 현재 기본값과 동일
  },
  {
    id: 'storm',
    label: '폭풍',
    description: '거친 파도',
    values: {
      waterRiseSpeed: 0.60,
      waveTimeScale: 0.75,
      waveStiffness: 0.35,
      waveMaxAmplitude: 8.0,
      rainImpactStrength: 0.12,
      glintStrength: 1.80,
      reflectivity: 0.30,
    },
  },
]
```

### SimulationOptions 컴포넌트 변경

파일: `src/modules/flood/components/SimulationOptions.jsx`

- **추가 prop**: `onPresetApply(presetValues)` — 프리셋 클릭 시 부모로 값 세트 전달
- **active 프리셋 감지**: 현재 `options`가 어느 프리셋과 **모든 키 값이 일치**하면 해당 버튼을 active 상태로 표시. 일치하는 프리셋이 없으면 아무 버튼도 active 안 함.
- `onPresetApply`는 `FloodMainUI` → `FloodModule`의 `handleOptionChange`를 여러 번 호출하거나, `setSimulationOptions(preset.values)` 를 한 번에 호출하는 방식 중 선택. **후자 권장** (atomic update).

### FloodMainUI 변경

파일: `src/modules/flood/components/FloodMainUI.jsx`

```jsx
// 추가 prop
onPresetApply,  // (values: SimulationOptions) => void

// SimulationOptions 에 전달
<SimulationOptions
  options={simulationOptions}
  onOptionChange={onOptionChange}
  onPresetApply={onPresetApply}  // ← 추가
/>
```

### FloodModule 변경

파일: `src/modules/flood/FloodModule.jsx`

```jsx
const handlePresetApply = useCallback((values) => {
  setSimulationOptions(values)
}, [])

// FloodMainUI에
onPresetApply={handlePresetApply}
```

### CSS 가이드 (프리셋 버튼)

클래스 네이밍: `.sim-preset-bar`, `.sim-preset-btn`, `.sim-preset-btn--active`

```css
/* SimulationOptions.css에 추가 */
.sim-preset-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.sim-preset-btn {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.sim-preset-btn:hover {
  border-color: var(--color-primary-border);
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.sim-preset-btn--active {
  border-color: var(--color-primary-border);
  background: var(--color-primary-dim);
  color: var(--color-primary);
}
```

---

## U-5 — 상태바 재난 문맥 추가

### 배경

현재 `MapStatusBar`는 경위도, 카메라 고도, 표고를 보여준다. 침수 시뮬레이션 중에도 "지금 침수가 발생하고 있는지"를 알 수 없다.

### 기획 결정

**상태바 우측에 침수 상태 pill을 추가한다.**  
`waterLevel > 0`이면 표시, `= 0`이면 숨김.

```
┌──────────────────────────────────────────────────────────────┐
│  경위도  37.49750°N, 127.02670°E  │  카메라 고도  312.5 m  │  지표 고도  10.3 m  │  💧 침수 중 8.50 m  │
└──────────────────────────────────────────────────────────────┘
```

- "지표 고도" — 현재 마우스 위치의 terrain 높이 (기존 "표고" 레이블 변경)
- "💧 침수 중 X.XX m" — waterLevel 값을 그대로 표시. 소수점 2자리.
- 아이콘은 💧 이모지 또는 CSS circle 도형 사용 (개발자 재량)

### MapStatusBar 변경

파일: `src/components/MapStatusBar.jsx`

```jsx
// 추가 prop
waterLevel = 0,

// 렌더링 추가 (기존 item들 뒤에)
{waterLevel > 0 && (
  <div className="map-status-bar__item map-status-bar__item--flood">
    <span className="map-status-bar__label">침수</span>
    <span className="map-status-bar__value map-status-bar__value--danger">
      💧 {Number(waterLevel).toFixed(2)} m
    </span>
  </div>
)}
```

레이블 변경: `표고` → `지표 고도`

### FloodModule 변경

파일: `src/modules/flood/FloodModule.jsx`

```jsx
<MapStatusBar
  viewerRef={viewerRef}
  isActive={isViewerReady}
  waterLevel={waterLevel}   // ← 추가
/>
```

### CSS 가이드

```css
/* MapStatusBar.css에 추가 */
.map-status-bar__item--flood {
  margin-left: auto;   /* 우측 끝 정렬 */
  padding-left: 20px;
  border-left: 1px solid var(--color-border);
}
```

---

## U-7 — 프리셋 시나리오

### 배경

처음 진입한 사용자가 "어떻게 시작할지" 모른다. 실제 사례 기반 시나리오 버튼을 제공하면 교육적 가치와 첫 인상을 동시에 높일 수 있다.

### 기획 결정

**사이드바 상단(강수 섹션 위)에 "📋 시나리오" CollapsibleSection을 추가한다.**  
기본 상태는 **열림**. 시나리오 버튼 클릭 시 강수·수위·자동상승을 일괄 세팅.

```
┌─────────────────────────────────┐
│  📋 시나리오               ▲   │  ← 기본 열림
│  ┌─────────────────────────┐   │
│  │ 🌧 소나기               │   │
│  │ 가볍게 비가 올 때       │   │
│  ├─────────────────────────┤   │
│  │ ⛈ 집중호우             │   │
│  │ 시간당 135mm 기준       │   │
│  ├─────────────────────────┤   │
│  │ 🚇 2022 강남역          │   │
│  │ 실제 침수 참고값        │   │
│  ├─────────────────────────┤   │
│  │ 🌀 태풍급               │   │
│  │ 최대 강수 + 급격한 상승 │   │
│  └─────────────────────────┘   │
│                                 │
│  강수                      ▲   │
│  ...                            │
```

### 시나리오 데이터 정의

새 파일: `src/modules/flood/constants/scenarios.js`

```js
/** @typedef {{ id: string, icon: string, label: string, description: string, rain: number, water: number, autoRise: boolean }} ScenarioDef */

/** @type {ScenarioDef[]} */
export const SCENARIOS = [
  {
    id: 'drizzle',
    icon: '🌧',
    label: '소나기',
    description: '가볍게 비가 올 때',
    rain: 40,
    water: 0,
    autoRise: true,
  },
  {
    id: 'heavy_rain',
    icon: '⛈',
    label: '집중호우',
    description: '시간당 135mm 기준',
    rain: 75,
    water: 3.5,
    autoRise: true,
  },
  {
    id: 'gangnam_2022',
    icon: '🚇',
    label: '2022 강남역',
    description: '실제 침수 참고값 (교육용)',
    rain: 85,
    water: 8.5,
    autoRise: false,
  },
  {
    id: 'typhoon',
    icon: '🌀',
    label: '태풍급',
    description: '최대 강수 + 급격한 상승',
    rain: 100,
    water: 15,
    autoRise: true,
  },
]
```

### ScenarioPanel 컴포넌트 (신규 생성)

파일: `src/modules/flood/components/ScenarioPanel.jsx`

```jsx
// Props
onApply(scenario: ScenarioDef): void

// 구조
<div className="scenario-panel">
  {SCENARIOS.map((s) => (
    <button key={s.id} className="scenario-btn" onClick={() => onApply(s)}>
      <span className="scenario-btn__icon">{s.icon}</span>
      <span className="scenario-btn__info">
        <span className="scenario-btn__label">{s.label}</span>
        <span className="scenario-btn__desc">{s.description}</span>
      </span>
    </button>
  ))}
</div>
```

### FloodMainUI 변경

파일: `src/modules/flood/components/FloodMainUI.jsx`

```jsx
// 추가 prop
onScenarioApply,  // (scenario: ScenarioDef) => void

// 콘텐츠 맨 위에 추가
<CollapsibleSection title="📋 시나리오" defaultOpen>
  <ScenarioPanel onApply={onScenarioApply} />
</CollapsibleSection>

// 기존 강수 섹션 아래로 이동
```

### FloodModule 변경

파일: `src/modules/flood/FloodModule.jsx`

```jsx
const handleScenarioApply = useCallback((scenario) => {
  setRainIntensity(scenario.rain)
  setWaterLevel(scenario.water)
  setAutoWaterRise(scenario.autoRise)
}, [])

// FloodMainUI에
onScenarioApply={handleScenarioApply}
```

### CSS 가이드

파일: `src/modules/flood/components/ScenarioPanel.css`

```css
.scenario-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.scenario-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-subtle);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.scenario-btn:hover {
  border-color: var(--color-primary-border);
  background: var(--color-surface-hover);
}

.scenario-btn__icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.scenario-btn__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scenario-btn__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.scenario-btn__desc {
  font-size: 11px;
  color: var(--color-text-subtle);
}
```

---

## U-8 — 모바일 경고

### 배경

사이드바 좌 320px + 우 280px 고정으로 1000px 미만 화면에서 레이아웃이 무너진다. Cesium 자체도 모바일 터치 조작 최적화가 되어 있지 않다. 완전한 반응형 대응 대신 **경고 오버레이**로 차단한다.

### 기획 결정

**768px 미만 화면 너비에서 전체 화면 경고 오버레이를 표시한다.**  
오버레이는 닫을 수 없다. 화면을 넓히거나 데스크탑에서 접속해야 사라진다.  
리사이즈 이벤트에 반응해 조건이 해소되면 자동으로 사라진다.

```
┌───────────────────────────┐
│                           │
│   🖥                      │
│                           │
│   데스크탑 환경에서        │
│   이용해 주세요            │
│                           │
│   GeoHazard Engine은      │
│   1000px 이상 화면에      │
│   최적화되어 있습니다.     │
│                           │
└───────────────────────────┘
```

### MobileWarning 컴포넌트 (신규 생성)

파일: `src/components/MobileWarning.jsx`

```jsx
import { useState, useEffect } from 'react'
import './MobileWarning.css'

const BREAKPOINT = 1000  // 기획 결정: 1000px (사이드바 합계 600px + 최소 맵 400px)

export default function MobileWarning() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINT)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!isMobile) return null

  return (
    <div className="mobile-warning" role="alertdialog" aria-label="모바일 미지원 안내">
      <div className="mobile-warning__card">
        <div className="mobile-warning__icon" aria-hidden="true">🖥</div>
        <h2 className="mobile-warning__title">데스크탑 환경에서 이용해 주세요</h2>
        <p className="mobile-warning__body">
          GeoHazard Engine은 1000px 이상 화면에 최적화되어 있습니다.
        </p>
      </div>
    </div>
  )
}
```

### App.jsx 변경

파일: `src/App.jsx`

```jsx
import MobileWarning from './components/MobileWarning'

// return 최상단에 추가 (ModuleShell 위)
<>
  <MobileWarning />
  <ModuleShell ...>
    ...
  </ModuleShell>
</>
```

### CSS 가이드

파일: `src/components/MobileWarning.css`

```css
.mobile-warning {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  padding: 24px;
}

.mobile-warning__card {
  max-width: 320px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.mobile-warning__icon {
  font-size: 48px;
  line-height: 1;
}

.mobile-warning__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.mobile-warning__body {
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
}
```

---

## 구현 순서 제안

| 순서 | 항목 | 예상 소요 | 이유 |
|------|------|-----------|------|
| 1 | U-8 모바일 경고 | 30분 | 파일 2개, 종속성 없음 |
| 2 | U-5 상태바 침수 표시 | 1시간 | prop 추가 + CSS |
| 3 | U-4 시뮬레이션 프리셋 | 2시간 | 상수 + 컴포넌트 수정 |
| 4 | U-7 시나리오 패널 | 2시간 | 파일 2개 신규 + 연결 |

각 항목은 독립적으로 구현 가능하다. 위 순서를 따르지 않아도 된다.

---

## 디자인 토큰 참고

모든 색상은 `src/index.css`에 정의된 CSS 변수를 사용한다.

| 토큰 | 용도 |
|------|------|
| `--color-primary` `#38bdf8` | 강수·파도·활성 버튼 |
| `--color-danger` `#f43f5e` | 수위·침수 경고 |
| `--color-text` `#f1f5f9` | 기본 텍스트 |
| `--color-text-muted` | 보조 텍스트 |
| `--color-text-subtle` | 힌트·설명 |
| `--color-surface` | 카드·버튼 배경 |
| `--color-surface-hover` | 호버 상태 배경 |
| `--color-border` | 테두리 |
| `--color-primary-dim` | 활성 버튼 배경 |
| `--color-primary-border` | 활성 버튼 테두리 |

## 관련 문서

- [기획·테스트 평가](./evaluation.md) — 문제 정의 원본
- [구현 기능](./features.md) — 현재 컴포넌트 구조
- [디자인 가이드](./design.md) — UI 레이아웃 개요
