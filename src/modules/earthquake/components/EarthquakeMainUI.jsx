/**
 * EarthquakeMainUI.jsx — 지진 모듈 좌측 제어 패널
 * 참조: earthquake-ui.md
 */

import { AlertTriangle, MapPin, Pause, Play } from 'lucide-react'
import CollapsibleSection from '../../../components/CollapsibleSection'
import Panel from '../../../components/ui/Panel'
import Field from '../../../components/ui/Field'
import Slider from '../../../components/ui/Slider'
import SwitchRow from '../../../components/ui/SwitchRow'
import { EPICENTER_PRESETS } from '../constants/earthquakePresets'
import { getMMIColor } from '../../../physics/EarthquakeWaveModel'
import './EarthquakeMainUI.css'

// ─── 포맷 유틸 ───────────────────────────────────────────────────

const fmtClock = (ms) => {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const fmtKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(0)} km` : `${Math.round(m)} m`)

/** 애니메이션 ms × 배속 → 물리 시간(초) 표기 */
const fmtSec = (ms, timeScale) => {
  const sec = (ms * timeScale) / 1000
  return sec < 100 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`
}

/** 애니메이션 ms × 배속 → 물리 시간 mm:ss */
const fmtPhysClock = (ms, timeScale) => fmtClock(ms * timeScale)

const fmtArea = (km2) => {
  if (km2 >= 10_000) return `${Math.round(km2 / 1000).toLocaleString('ko-KR')}천 km²`
  return `${Math.round(km2).toLocaleString('ko-KR')} km²`
}

const fmtPopulation = (n) => {
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만 명`
  return `${Math.round(n).toLocaleString('ko-KR')}명`
}

const magnitudeHint = (m) => {
  if (m < 5.0) return '소규모 — 일부 지역에서 약한 흔들림'
  if (m < 6.0) return '중규모 — 진앙 인근 건물 피해 가능'
  if (m < 7.0) return '대규모 — 광범위한 피해 가능'
  return '초대규모 — 광역 재난 수준'
}

// ─── 진원 프리셋 ─────────────────────────────────────────────────

function EpicenterPresetList({ activeId, disabled, onSelect }) {
  return (
    <div className="option-list" role="radiogroup" aria-label="진원 프리셋">
      {EPICENTER_PRESETS.map((preset) => {
        const isActive = activeId === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`option-row${isActive ? ' option-row--active' : ''}`}
            disabled={disabled}
            onClick={() => onSelect(preset)}
            title={preset.description}
          >
            <span className="option-row__main">
              <span className="option-row__title">
                {preset.name ?? preset.label}
                {preset.kind === 'historical' ? (
                  <span className="tag">{preset.year} 관측</span>
                ) : (
                  <span className="tag">가상</span>
                )}
              </span>
              <span className="option-row__desc">{preset.description}</span>
            </span>
            <span className="option-row__meta">
              <span>M {preset.magnitude.toFixed(1)}</span>
              <span>{preset.depthKm} km</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── 피해 추정 ───────────────────────────────────────────────────

function MmiChip({ mmi, label }) {
  return (
    <span className="mmi-chip">
      <span className="mmi-chip__swatch" style={{ background: getMMIColor(mmi) }} aria-hidden="true" />
      {label}
    </span>
  )
}

function ImpactPanel({ impactSummary, timeScale }) {
  if (!impactSummary) {
    return <p className="field__hint">시뮬레이션을 시작하면 도시별 도달 시각과 진도가 표시됩니다.</p>
  }

  // 도달 순(진앙 거리 순) 정렬 — 미도달·범위 밖은 하단
  const byArrival = (a, b) => (a.sArrivalMs ?? Infinity) - (b.sArrivalMs ?? Infinity)
  const reached = impactSummary.cities.filter((c) => c.sWaveReached).sort(byArrival)
  const pending = impactSummary.cities.filter((c) => !c.sWaveReached).sort(byArrival)

  const metrics = [
    ['P파 반경', `${impactSummary.pWaveRadiusKm.toFixed(0)} km`],
    ['S파 반경', `${impactSummary.sWaveRadiusKm.toFixed(0)} km`],
    ['영향 도시', `${impactSummary.affectedCount} / ${impactSummary.totalCities}`],
    ['최대 진도', impactSummary.maxMMI > 0 ? `MMI ${impactSummary.maxMMILabel}` : '—'],
    ['영향 면적', impactSummary.sWaveRadiusKm > 0 ? fmtArea(impactSummary.estimatedAreaKm2) : '—'],
    [
      '노출 인구',
      impactSummary.estimatedAffectedPopulation > 0
        ? fmtPopulation(impactSummary.estimatedAffectedPopulation)
        : '—',
    ],
  ]

  return (
    <>
      <div className="kv">
        {metrics.map(([label, value]) => (
          <div key={label} className="kv__cell">
            <span className="kv__label">{label}</span>
            <span className="kv__value">{value}</span>
          </div>
        ))}
      </div>

      {(impactSummary.strongShakeCount > 0 || impactSummary.liquefactionAreaKm2 > 0) && (
        <div className="notice notice--warning">
          <AlertTriangle size={13} strokeWidth={2} color="var(--warning)" aria-hidden="true" />
          <span>
            {impactSummary.strongShakeCount > 0 &&
              `MMI VI 이상 ${impactSummary.strongShakeCount}개 도시 — OSM 건물 손상색 표시. `}
            {impactSummary.liquefactionAreaKm2 > 0 &&
              `연안·하구 저지대 액상화 위험 ${fmtArea(impactSummary.liquefactionAreaKm2)}.`}
          </span>
        </div>
      )}

      <table className="eq-city-table">
        <thead>
          <tr>
            <th scope="col">도시</th>
            <th scope="col">진도</th>
            <th scope="col" className="num">P 도달</th>
            <th scope="col" className="num">S 도달</th>
          </tr>
        </thead>
        <tbody>
          {reached.map((city) => (
            <tr key={city.id}>
              <td>{city.label}</td>
              <td>
                <MmiChip mmi={city.mmi} label={city.mmiLabel} />
              </td>
              <td className="num">{city.pArrivalMs != null ? fmtSec(city.pArrivalMs, timeScale) : '—'}</td>
              <td className="num">{city.sArrivalMs != null ? fmtSec(city.sArrivalMs, timeScale) : '—'}</td>
            </tr>
          ))}
          {pending.map((city) => (
            <tr key={city.id} className="eq-city-table__row--pending">
              <td>{city.label}</td>
              <td colSpan={3} className="num">
                {city.etaMs != null ? `S파 도달까지 ${fmtSec(city.etaMs, timeScale)}` : '전파 범위 밖'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ─── 진행 단계 ───────────────────────────────────────────────────

function TimelineStep({ status, label, sub }) {
  return (
    <li className={`eq-tl__step eq-tl__step--${status}`}>
      <span className="eq-tl__dot" aria-hidden="true" />
      <span className="eq-tl__label">{label}</span>
      {sub && <span className="eq-tl__sub">{sub}</span>}
    </li>
  )
}

function EarthquakeSimTimeline({
  phase,
  elapsedMs,
  impactSummary,
  pRadiusM,
  firstSArrivalMs,
  maxPropagationKm,
  aftershockPlan = [],
  activeAftershock,
  timeScale,
}) {
  const affectedCount = impactSummary?.affectedCount ?? 0
  const totalCities = impactSummary?.totalCities ?? 0

  const isPwave = phase === 'pwave'
  const isSwave = phase === 'swave' || phase === 'shaking'
  const isDone = phase === 'done'
  const isAftershock = phase === 'aftershock'
  const isLiquefaction = phase === 'liquefaction' || (impactSummary?.liquefactionAreaKm2 ?? 0) > 0

  return (
    <ol className="eq-tl">
      <TimelineStep status="done" label="진원 파열" sub="지하 단층 파열 발생" />
      <TimelineStep
        status={isDone || isSwave ? 'done' : isPwave ? 'active' : 'pending'}
        label="P파 전파"
        sub={isPwave ? `${fmtKm(pRadiusM)} 전파 중` : null}
      />
      <TimelineStep
        status={isDone ? 'done' : isSwave ? 'active' : 'pending'}
        label="S파 도달"
        sub={
          isSwave || isDone
            ? `${affectedCount} / ${totalCities}개 도시 흔들림`
            : firstSArrivalMs != null
              ? `첫 도달까지 ${fmtSec(Math.max(0, firstSArrivalMs - elapsedMs), timeScale)}`
              : null
        }
      />
      <TimelineStep
        status={isDone || isAftershock ? 'done' : isLiquefaction ? 'active' : 'pending'}
        label="지표 균열·액상화"
        sub={
          isLiquefaction
            ? `위험 구역 ${fmtArea(impactSummary?.liquefactionAreaKm2 ?? 0)}`
            : 'MMI VI 이상 연안·하구'
        }
      />
      {aftershockPlan.length > 0 && (
        <TimelineStep
          status={isAftershock ? 'active' : isDone ? 'done' : 'pending'}
          label="여진"
          sub={
            isAftershock && activeAftershock
              ? `${activeAftershock.label} · M ${activeAftershock.magnitude.toFixed(1)}`
              : `${aftershockPlan.length}회 예정`
          }
        />
      )}
      <TimelineStep
        status={isDone ? 'done' : 'pending'}
        label="전파 종료"
        sub={isDone ? `최대 ${maxPropagationKm} km` : null}
      />
    </ol>
  )
}

// ─── 재생 컨트롤 (패널 푸터) ─────────────────────────────────────

function Transport({
  simState,
  elapsedMs,
  totalMs,
  firstPArrivalMs,
  firstSArrivalMs,
  shakeAlert,
  timeScale,
  onStart,
  onPause,
  onSeek,
}) {
  const isRunning = simState === 'running'
  const isPaused = simState === 'paused'
  const isDone = simState === 'done'
  const isActive = isRunning || isPaused || isDone

  const max = Math.max(1, Math.round(totalMs))
  const value = Math.min(Math.round(elapsedMs), max)
  const pct = (ms) => (ms != null && totalMs > 0 ? `${(ms / totalMs) * 100}%` : null)

  return (
    <div className="eq-transport">
      {shakeAlert && (
        <div className="notice notice--danger" role="alert">
          <AlertTriangle size={13} strokeWidth={2} color="var(--danger)" aria-hidden="true" />
          <span>현재 시점 흔들림 감지 — MMI {shakeAlert.mmiLabel || shakeAlert.mmi?.toFixed(0)}</span>
        </div>
      )}

      <div className="eq-transport__row">
        {isRunning ? (
          <button type="button" className="btn btn--lg eq-transport__play" onClick={onPause}>
            <Pause size={14} strokeWidth={2.25} aria-hidden="true" />
            일시정지
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary btn--lg eq-transport__play"
            disabled={isDone}
            onClick={onStart}
          >
            <Play size={14} strokeWidth={2.25} aria-hidden="true" />
            {isPaused ? '재개' : isDone ? '완료' : '시뮬레이션 시작'}
          </button>
        )}
        <span className="eq-transport__clock mono" aria-label="발생 후 경과 시간">
          T+{fmtPhysClock(isActive ? elapsedMs : 0, timeScale)}
          <span className="eq-transport__total"> / {fmtPhysClock(totalMs, timeScale)}</span>
        </span>
        <span className="tag" title={`실제 1초에 ${timeScale}초가 진행됩니다`}>×{timeScale}</span>
      </div>

      {isActive && (
        <div className="eq-scrub">
          <div className="eq-scrub__track">
            {pct(firstPArrivalMs) && (
              <span
                className="eq-scrub__marker eq-scrub__marker--p"
                style={{ left: pct(firstPArrivalMs) }}
                title={`P파 첫 도달 ${fmtSec(firstPArrivalMs, timeScale)}`}
              />
            )}
            {pct(firstSArrivalMs) && (
              <span
                className="eq-scrub__marker eq-scrub__marker--s"
                style={{ left: pct(firstSArrivalMs) }}
                title={`S파 첫 도달 ${fmtSec(firstSArrivalMs, timeScale)}`}
              />
            )}
            <Slider
              aria-label="시뮬레이션 시점 이동"
              min={0}
              max={max}
              step={100}
              value={value}
              onChange={(e) => onSeek?.(Number(e.target.value))}
            />
          </div>
          <div className="field__range">
            <span>0s</span>
            {firstPArrivalMs != null && (
              <span className="eq-scrub__label--p">P 첫 도달 {fmtSec(firstPArrivalMs, timeScale)}</span>
            )}
            {firstSArrivalMs != null && (
              <span className="eq-scrub__label--s">S 첫 도달 {fmtSec(firstSArrivalMs, timeScale)}</span>
            )}
            <span>{fmtSec(totalMs, timeScale)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 패널 ───────────────────────────────────────────────────

export default function EarthquakeMainUI({
  simState,
  phase,
  epicenter,
  options,
  impactSummary,
  elapsedMs,
  pRadiusM,
  totalMs,
  isPickMode,
  shakeAlert,
  aftershockPlan = [],
  activeAftershock,
  onEpicenterChange,
  onOptionsChange,
  onPickEpicenter,
  onStart,
  onPause,
  onReset,
  onSeek,
}) {
  const isActive = simState === 'running' || simState === 'paused' || simState === 'done'
  const controlsLocked = isActive

  const firstPArrivalMs = impactSummary?.firstPArrivalMs ?? null
  const firstSArrivalMs = impactSummary?.firstSArrivalMs ?? null

  return (
    <Panel
      title="지진동 전파"
      location={`한반도 · ${epicenter.name ?? epicenter.label}`}
      onReset={onReset}
      label="지진 시뮬레이션 설정"
      footer={
        <Transport
          simState={simState}
          elapsedMs={elapsedMs}
          totalMs={totalMs}
          firstPArrivalMs={firstPArrivalMs}
          firstSArrivalMs={firstSArrivalMs}
          shakeAlert={shakeAlert}
          timeScale={options.timeScale}
          onStart={onStart}
          onPause={onPause}
          onSeek={onSeek}
        />
      }
    >
      <CollapsibleSection title="진원" defaultOpen>
        <EpicenterPresetList
          activeId={epicenter.id}
          disabled={controlsLocked}
          onSelect={onEpicenterChange}
        />
        <div className="kv kv--4">
          <div className="kv__cell kv__cell--span2">
            <span className="kv__label">진앙</span>
            <span className="kv__value">
              {epicenter.lat.toFixed(2)}° N, {epicenter.lon.toFixed(2)}° E
            </span>
          </div>
          <div className="kv__cell">
            <span className="kv__label">깊이</span>
            <span className="kv__value">{options.depthKm} km</span>
          </div>
          <div className="kv__cell">
            <span className="kv__label">규모</span>
            <span className="kv__value">M {options.magnitude.toFixed(1)}</span>
          </div>
        </div>
        <button
          type="button"
          className={`btn btn--block${isPickMode ? ' btn--active' : ''}`}
          disabled={controlsLocked}
          onClick={onPickEpicenter}
          aria-pressed={isPickMode}
        >
          <MapPin size={13} strokeWidth={2} aria-hidden="true" />
          {isPickMode ? '지도에서 진앙을 클릭하세요' : '지도에서 진앙 지정'}
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="지진 파라미터" defaultOpen>
        <Field
          id="eq-magnitude"
          label="규모"
          value={options.magnitude}
          displayValue={`M ${options.magnitude.toFixed(1)}`}
          min={4}
          max={8}
          step={0.1}
          minLabel="4.0"
          maxLabel="8.0"
          hint={magnitudeHint(options.magnitude)}
          disabled={controlsLocked}
          onChange={(v) => onOptionsChange('magnitude', v)}
        />
        <Field
          id="eq-depth"
          label="진원 깊이"
          value={options.depthKm}
          unit="km"
          min={1}
          max={60}
          step={1}
          minLabel="1 km"
          maxLabel="60 km"
          disabled={controlsLocked}
          onChange={(v) => onOptionsChange('depthKm', v)}
        />
        <SwitchRow
          label="여진 시퀀스 포함"
          description="본진 이후 규모가 작은 여진을 순차적으로 재현합니다"
          checked={options.aftershocksEnabled !== false}
          disabled={controlsLocked}
          onChange={(v) => onOptionsChange('aftershocksEnabled', v)}
        />
      </CollapsibleSection>

      {isActive && (
        <CollapsibleSection title="진행 단계" defaultOpen aside={`T+${fmtPhysClock(elapsedMs, options.timeScale)}`}>
          <EarthquakeSimTimeline
            phase={phase}
            elapsedMs={elapsedMs}
            impactSummary={impactSummary}
            pRadiusM={pRadiusM}
            firstSArrivalMs={firstSArrivalMs}
            maxPropagationKm={options.maxPropagationKm}
            aftershockPlan={aftershockPlan}
            activeAftershock={activeAftershock}
            timeScale={options.timeScale}
          />
        </CollapsibleSection>
      )}

      <CollapsibleSection title="피해 추정" defaultOpen>
        <ImpactPanel impactSummary={isActive ? impactSummary : null} timeScale={options.timeScale} />
      </CollapsibleSection>
    </Panel>
  )
}
