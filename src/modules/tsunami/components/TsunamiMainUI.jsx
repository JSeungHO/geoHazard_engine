import CollapsibleSection from '../../../components/CollapsibleSection'
import { EPICENTER_PRESETS } from '../constants/tsunamiPresets'
import './TsunamiMainUI.css'

const formatElapsed = (elapsedMs) => {
  const totalSec = Math.floor(elapsedMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const formatRadius = (radiusM) => {
  if (radiusM >= 1000) return `${(radiusM / 1000).toFixed(1)} km`
  return `${Math.round(radiusM)} m`
}

const formatArea = (km2) => {
  if (km2 >= 1_000_000) return `${(km2 / 1_000_000).toFixed(2)} M km²`
  if (km2 >= 1000) return `${(km2 / 1000).toFixed(1)}k km²`
  return `${Math.round(km2)} km²`
}

function ScrubBar({ elapsedMs, totalMs, firstArrivalMs, onSeek }) {
  const max = Math.round(totalMs)
  const value = Math.min(Math.round(elapsedMs), max)
  const arrivalPct = firstArrivalMs != null && totalMs > 0
    ? (firstArrivalMs / totalMs) * 100
    : 0

  return (
    <div className="scrub-bar">
      <div className="scrub-bar__track">
        {firstArrivalMs != null && (
          <div
            className="scrub-bar__marker"
            style={{ left: `${arrivalPct}%` }}
            title="첫 연안 도달"
          />
        )}
        <input
          type="range"
          className="scrub-bar__input"
          min={0}
          max={max}
          step={100}
          value={value}
          onChange={(e) => onSeek?.(Number(e.target.value))}
        />
      </div>
      <div className="scrub-bar__labels">
        <span>0s</span>
        {firstArrivalMs != null && (
          <span className="scrub-bar__arrival-label">
            연안 {(firstArrivalMs / 1000).toFixed(0)}s
          </span>
        )}
        <span>{(totalMs / 1000).toFixed(0)}s</span>
      </div>
    </div>
  )
}

function TimelineStep({ status, label, sub }) {
  return (
    <div className={`tl-step tl-step--${status}`}>
      <div className="tl-step__dot" aria-hidden="true" />
      <div className="tl-step__body">
        <span className="tl-step__label">{label}</span>
        {sub && <span className="tl-step__sub">{sub}</span>}
      </div>
    </div>
  )
}

function ImpactSummaryPanel({ impactSummary, impactPoints }) {
  if (!impactSummary) return null

  const affected = impactSummary.impacts.filter((item) => item.reached)

  return (
    <div className="impact-summary">
      <div className="impact-summary__grid">
        <div className="impact-summary__cell">
          <span className="impact-summary__label">파면 반경</span>
          <strong>{impactSummary.ringRadiusKm.toFixed(1)} km</strong>
        </div>
        <div className="impact-summary__cell">
          <span className="impact-summary__label">영향 추정 면적</span>
          <strong>{formatArea(impactSummary.estimatedAreaKm2)}</strong>
        </div>
        <div className="impact-summary__cell">
          <span className="impact-summary__label">피해 연안</span>
          <strong>{impactSummary.affectedCount} / {impactSummary.totalCoastalPoints}</strong>
        </div>
        <div className="impact-summary__cell">
          <span className="impact-summary__label">최대 파고</span>
          <strong>{impactSummary.maxWaveHeightM.toFixed(1)} m</strong>
        </div>
      </div>

      {affected.length > 0 && (
        <ul className="impact-summary__list">
          {affected.map((item) => (
            <li key={item.id}>
              <span>{item.label}</span>
              <span>{item.waveHeightM.toFixed(1)} m</span>
              <span className="impact-summary__dist">{item.distanceKm.toFixed(0)} km</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SimTimeline({
  phase,
  elapsedMs,
  firstArrivalMs,
  impactSummary,
  ringRadiusM,
  totalMs,
}) {
  const travelPct = firstArrivalMs != null && firstArrivalMs > 0
    ? Math.min((elapsedMs / firstArrivalMs) * 100, 100)
    : Math.min((elapsedMs / totalMs) * 100, 100)

  const impactPct = impactSummary?.totalCoastalPoints
    ? (impactSummary.affectedCount / impactSummary.totalCoastalPoints) * 100
    : 0

  const secToCoast = firstArrivalMs != null
    ? Math.max(0, (firstArrivalMs - elapsedMs) / 1000)
    : null

  const isTraveling = phase === 'traveling'
  const isImpacting = phase === 'impacting'
  const isDone = phase === 'done'
  const reachedCoast = phase === 'impacting' || phase === 'done'

  return (
    <div className="sim-timeline">
      <div className="sim-timeline__header">
        <span className="sim-timeline__clock">{formatElapsed(elapsedMs)}</span>
        <span className="sim-timeline__radius">{formatRadius(ringRadiusM)}</span>
      </div>

      <TimelineStep status="done" label="진원 진동" sub="해저에서 파면 생성" />

      <div className="tl-connector">
        <div className="tl-bar">
          <div
            className={`tl-bar__fill${isTraveling ? ' tl-bar__fill--animated' : ''}`}
            style={{ width: `${travelPct}%` }}
          />
        </div>
        {isTraveling && secToCoast != null && (
          <div className="tl-eta">
            <span className="tl-eta__wave" aria-hidden="true">🌊</span>
            진원→연안 전파 · <strong>{secToCoast.toFixed(1)}초</strong>
          </div>
        )}
      </div>

      <TimelineStep
        status={reachedCoast ? 'done' : 'pending'}
        label="연안 피해"
        sub={
          reachedCoast
            ? `${impactSummary?.affectedCount ?? 0}개 지점 침수`
            : secToCoast != null
              ? `대형 파면 접근 · ${secToCoast.toFixed(1)}초`
              : '파면 전파 중'
        }
      />

      {reachedCoast && (
        <div className="tl-connector">
          <div className="tl-bar">
            <div
              className={`tl-bar__fill tl-bar__fill--flood${isImpacting ? ' tl-bar__fill--animated' : ''}`}
              style={{ width: `${impactPct}%` }}
            />
          </div>
        </div>
      )}

      <TimelineStep
        status={isDone ? 'done' : 'pending'}
        label="전파 완료"
        sub={isDone ? `최대 ${formatRadius(ringRadiusM)}` : '범위 확장 중'}
      />
    </div>
  )
}

export default function TsunamiMainUI({
  simState,
  phase,
  epicenter,
  tsunamiOptions,
  impactSummary,
  impactPoints,
  elapsedMs,
  ringRadiusM,
  firstArrivalMs,
  totalMs,
  onEpicenterChange,
  onOptionsChange,
  isPickMode = false,
  onStart,
  onPause,
  onReset,
  onSeek,
  onPickEpicenter,
}) {
  const isRunning = simState === 'running'
  const isPaused = simState === 'paused'
  const isDone = simState === 'done'
  const isActive = isRunning || isPaused || isDone
  const controlsLocked = isRunning || isPaused || isDone

  return (
    <aside className="tsunami-main-ui">
      <header className="tsunami-main-ui__header">
        <div className="tsunami-main-ui__header-row">
          <div>
            <h1 className="tsunami-main-ui__title">GeoHazard Engine</h1>
            <p className="tsunami-main-ui__subtitle">연안 쓰나미 · 파면 범위·피해 규모</p>
          </div>
          <button type="button" className="tsunami-main-ui__reset" onClick={onReset}>
            초기화
          </button>
        </div>
      </header>

      <div className="tsunami-main-ui__content">
        <CollapsibleSection title="진원 설정" defaultOpen>
          <div className="tsunami-main-ui__preset-row">
            {EPICENTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`tsunami-main-ui__preset${epicenter.id === preset.id ? ' tsunami-main-ui__preset--active' : ''}`}
                disabled={controlsLocked}
                onClick={() => onEpicenterChange(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="tsunami-main-ui__coords">
            <span>위도 {epicenter.lat.toFixed(2)}°</span>
            <span>경도 {epicenter.lon.toFixed(2)}°</span>
          </div>
          <p className="tsunami-main-ui__hint">
            참조 연안 {impactPoints.length}곳 — {impactPoints.map((p) => p.label).join(', ')}
          </p>
          <button
            type="button"
            className={`tsunami-main-ui__pick${isPickMode ? ' tsunami-main-ui__pick--active' : ''}`}
            disabled={controlsLocked}
            onClick={onPickEpicenter}
          >
            {isPickMode ? '지도에서 클릭…' : '지도에서 선택'}
          </button>
        </CollapsibleSection>

        <CollapsibleSection title="파면 설정" defaultOpen>
          <label className="tsunami-main-ui__field">
            <span className="tsunami-main-ui__field-label">
              최대 파고 {tsunamiOptions.maxWaveHeight.toFixed(1)} m
            </span>
            <input
              type="range"
              min="3"
              max="20"
              step="0.5"
              value={tsunamiOptions.maxWaveHeight}
              disabled={controlsLocked}
              onChange={(e) => onOptionsChange('maxWaveHeight', Number(e.target.value))}
            />
          </label>
          <label className="tsunami-main-ui__field">
            <span className="tsunami-main-ui__field-label">
              최대 전파 {tsunamiOptions.maxPropagationKm.toFixed(0)} km
            </span>
            <input
              type="range"
              min="100"
              max="800"
              step="50"
              value={tsunamiOptions.maxPropagationKm}
              disabled={controlsLocked}
              onChange={(e) => onOptionsChange('maxPropagationKm', Number(e.target.value))}
            />
          </label>
        </CollapsibleSection>

        <CollapsibleSection title="피해 범위" defaultOpen>
          {isActive ? (
            <ImpactSummaryPanel impactSummary={impactSummary} impactPoints={impactPoints} />
          ) : (
            <p className="tsunami-main-ui__hint">
              시뮬레이션 시작 후 파면 반경·연안별 예상 파고·영향 면적이 표시됩니다.
            </p>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="시뮬레이션" defaultOpen>
          <div className="tsunami-main-ui__actions">
            {isRunning ? (
              <button type="button" className="tsunami-main-ui__action" onClick={onPause}>
                ⏸ 일시정지
              </button>
            ) : (
              <button
                type="button"
                className="tsunami-main-ui__action tsunami-main-ui__action--primary"
                disabled={isDone}
                onClick={onStart}
              >
                {isPaused ? '▶ 재개' : '▶ 시작'}
              </button>
            )}
          </div>

          {isActive && (
            <>
              <SimTimeline
                phase={phase}
                elapsedMs={elapsedMs}
                firstArrivalMs={firstArrivalMs}
                impactSummary={impactSummary}
                ringRadiusM={ringRadiusM}
                totalMs={totalMs}
              />
              <ScrubBar
                elapsedMs={elapsedMs}
                totalMs={totalMs}
                firstArrivalMs={firstArrivalMs}
                onSeek={onSeek}
              />
            </>
          )}
        </CollapsibleSection>
      </div>

      <footer className="tsunami-main-ui__footer">
        <div className="tsunami-main-ui__stat">
          <span className="tsunami-main-ui__stat-label">상태</span>
          <span className="tsunami-main-ui__stat-value">
            {simState === 'idle' && '대기'}
            {simState === 'running' && '전파 중'}
            {simState === 'paused' && '일시정지'}
            {simState === 'done' && '완료'}
          </span>
        </div>
        <div className="tsunami-main-ui__stat">
          <span className="tsunami-main-ui__stat-label">피해 연안</span>
          <span className="tsunami-main-ui__stat-value">
            {impactSummary?.affectedCount ?? 0}곳
          </span>
        </div>
      </footer>
    </aside>
  )
}
