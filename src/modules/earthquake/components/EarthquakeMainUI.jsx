/**
 * EarthquakeMainUI.jsx — 지진 모듈 사이드바
 * 참조: earthquake-ui.md
 */

import { useState, useEffect, useRef } from 'react'
import CollapsibleSection from '../../../components/CollapsibleSection'
import { EPICENTER_PRESETS } from '../constants/earthquakePresets'
import './EarthquakeMainUI.css'

// ─── 포맷 유틸 ───────────────────────────────────────────────────

const fmtElapsed = (ms) => {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const fmtKm = (m) => (m >= 1000 ? `${(m / 1000).toFixed(0)} km` : `${Math.round(m)} m`)

const fmtSec = (ms) => `${(ms / 1000).toFixed(0)}s`

const magnitudeHint = (m) => {
  if (m < 5.0) return 'M 4~4.9 — 소규모·일부 지역 약한 흔들림'
  if (m < 6.0) return 'M 5~5.9 — 중규모·건물 피해 가능'
  if (m < 7.0) return 'M 6~6.9 — 대규모·광범위한 피해'
  return 'M 7+ — 초대규모·대규모 재난'
}

// ─── ScrubBar ────────────────────────────────────────────────────

function ScrubBar({ elapsedMs, totalMs, firstPArrivalMs, firstSArrivalMs, onSeek }) {
  const max = Math.round(totalMs)
  const value = Math.min(Math.round(elapsedMs), max)

  const pPct = firstPArrivalMs != null && totalMs > 0 ? (firstPArrivalMs / totalMs) * 100 : null
  const sPct = firstSArrivalMs != null && totalMs > 0 ? (firstSArrivalMs / totalMs) * 100 : null

  return (
    <div className="scrub-bar">
      <div className="scrub-bar__track">
        {pPct != null && (
          <div
            className="scrub-bar__marker scrub-bar__marker--pwave"
            style={{ left: `${pPct}%` }}
            title={`P파 최초 도달 ${fmtSec(firstPArrivalMs)}`}
          />
        )}
        {sPct != null && (
          <div
            className="scrub-bar__marker scrub-bar__marker--swave"
            style={{ left: `${sPct}%` }}
            title={`S파 최초 도달 ${fmtSec(firstSArrivalMs)}`}
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
        {firstPArrivalMs != null && (
          <span className="scrub-bar__label--pwave">P {fmtSec(firstPArrivalMs)}</span>
        )}
        {firstSArrivalMs != null && (
          <span className="scrub-bar__label--swave">S {fmtSec(firstSArrivalMs)}</span>
        )}
        <span>{fmtSec(totalMs)}</span>
      </div>
    </div>
  )
}

// ─── EarthquakeSimTimeline ───────────────────────────────────────

function TimelineStep({ status, label, sub, progress, barClass }) {
  return (
    <div className={`eq-tl__step eq-tl__step--${status}`}>
      <div className="eq-tl__dot" aria-hidden="true" />
      <div className="eq-tl__body">
        <span className="eq-tl__label">{label}</span>
        {sub && <span className="eq-tl__sub">{sub}</span>}
        {progress != null && (
          <div className="eq-tl__bar-track">
            <div
              className={`eq-tl__bar-fill ${barClass ?? ''}`}
              style={{ width: `${Math.round(progress)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function EarthquakeSimTimeline({
  phase,
  elapsedMs,
  impactSummary,
  pRadiusM,
  sRadiusM,
  totalMs,
  firstPArrivalMs,
  firstSArrivalMs,
  maxPropagationKm,
  shakeAlert,
}) {
  const pPct = firstPArrivalMs != null && firstPArrivalMs > 0
    ? Math.min((elapsedMs / firstPArrivalMs) * 100, 100)
    : Math.min((elapsedMs / totalMs) * 100, 100)

  const sPct = firstSArrivalMs != null && firstSArrivalMs > 0
    ? Math.min((elapsedMs / firstSArrivalMs) * 100, 100)
    : Math.min((elapsedMs / totalMs) * 100, 100)

  const affectedCount = impactSummary?.affectedCount ?? 0
  const totalCities = impactSummary?.totalCities ?? 0

  const isPwave = phase === 'pwave'
  const isSwave = phase === 'swave' || phase === 'shaking'
  const isDone = phase === 'done'
  const sReached = isSwave || isDone

  return (
    <div className="eq-tl">
      <div className="eq-tl__header">
        <span className="eq-tl__clock">{fmtElapsed(elapsedMs)}</span>
        <span className="eq-tl__radius">P {fmtKm(pRadiusM)}</span>
        <span className="eq-tl__radius eq-tl__radius--s">S {fmtKm(sRadiusM)}</span>
      </div>

      <TimelineStep status="done" label="진원 진동" sub="지하 지진 발생" />

      <TimelineStep
        status={isDone ? 'done' : isPwave || isSwave ? 'active' : 'pending'}
        label="P파 전파"
        sub={
          affectedCount > 0
            ? `${affectedCount}개 도시 S파 도달`
            : isPwave
              ? `${fmtKm(pRadiusM)} 전파 중`
              : 'P파 이동 중'
        }
        progress={pPct}
        barClass="eq-tl__bar-fill--pwave"
      />

      <TimelineStep
        status={isDone ? 'done' : isSwave ? 'active' : 'pending'}
        label="S파 도달"
        sub={
          isSwave || isDone
            ? `${affectedCount} / ${totalCities}개 도시 흔들림`
            : firstSArrivalMs != null
              ? `최초 도달까지 ${Math.max(0, (firstSArrivalMs - elapsedMs) / 1000).toFixed(1)}초`
              : 'S파 이동 중'
        }
        progress={sReached ? sPct : null}
        barClass="eq-tl__bar-fill--swave"
      />

      <TimelineStep
        status={isDone ? 'done' : 'pending'}
        label="전파 완료"
        sub={isDone ? `최대 ${maxPropagationKm} km` : '전파 범위 확장 중'}
      />

      {shakeAlert && (
        <div className="earthquake-main-ui__shake-alert">
          ⚡ 현재 위치 흔들림 — MMI {shakeAlert.mmiLabel || shakeAlert.mmi?.toFixed(0)}
        </div>
      )}
    </div>
  )
}

// ─── 피해 범위 패널 ──────────────────────────────────────────────

function ImpactPanel({ impactSummary, elapsedMs }) {
  if (!impactSummary) return (
    <p className="earthquake-main-ui__hint">시뮬레이션 시작 후 실시간으로 표시됩니다.</p>
  )

  const reached = impactSummary.cities.filter((c) => c.sWaveReached)
  const notReached = impactSummary.cities.filter((c) => !c.sWaveReached)

  return (
    <div>
      <div className="earthquake-main-ui__stats">
        <div className="earthquake-main-ui__stat">
          <span className="earthquake-main-ui__stat-value">{impactSummary.pWaveRadiusKm.toFixed(0)} km</span>
          <span className="earthquake-main-ui__stat-label">P파 반경</span>
        </div>
        <div className="earthquake-main-ui__stat">
          <span className="earthquake-main-ui__stat-value">{impactSummary.sWaveRadiusKm.toFixed(0)} km</span>
          <span className="earthquake-main-ui__stat-label">S파 반경</span>
        </div>
        <div className="earthquake-main-ui__stat">
          <span className="earthquake-main-ui__stat-value">
            {impactSummary.affectedCount} / {impactSummary.totalCities}
          </span>
          <span className="earthquake-main-ui__stat-label">영향 도시</span>
        </div>
        <div className="earthquake-main-ui__stat">
          <span className="earthquake-main-ui__stat-value">
            {impactSummary.maxMMI > 0 ? `MMI ${impactSummary.maxMMILabel}` : '—'}
          </span>
          <span className="earthquake-main-ui__stat-label">최대 진도</span>
        </div>
      </div>

      {reached.length > 0 && (
        <ul className="earthquake-main-ui__city-list">
          {reached.map((city) => (
            <li key={city.id} className="earthquake-main-ui__city-item earthquake-main-ui__city-item--reached">
              <span className="earthquake-main-ui__city-emoji">{city.mmiEmoji}</span>
              <span className="earthquake-main-ui__city-name">{city.label}</span>
              <span className="earthquake-main-ui__city-mmi">MMI {city.mmiLabel}</span>
              <span className="earthquake-main-ui__city-time">
                P {city.pArrivalMs != null ? fmtSec(city.pArrivalMs) : '—'}
                &nbsp;S {city.sArrivalMs != null ? fmtSec(city.sArrivalMs) : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {notReached.length > 0 && (
        <ul className="earthquake-main-ui__city-list earthquake-main-ui__city-list--pending">
          {notReached.map((city) => (
            <li key={city.id} className="earthquake-main-ui__city-item">
              <span className="earthquake-main-ui__city-emoji">⚪</span>
              <span className="earthquake-main-ui__city-name">{city.label}</span>
              <span className="earthquake-main-ui__city-eta">
                {city.etaMs != null ? `도달까지 ${fmtSec(city.etaMs)}` : '범위 외'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── 메인 사이드바 ───────────────────────────────────────────────

export default function EarthquakeMainUI({
  simState,
  phase,
  epicenter,
  options,
  impactSummary,
  elapsedMs,
  pRadiusM,
  sRadiusM,
  totalMs,
  isPickMode,
  shakeAlert,
  onEpicenterChange,
  onOptionsChange,
  onPickEpicenter,
  onStart,
  onPause,
  onReset,
  onSeek,
}) {
  const isRunning = simState === 'running'
  const isPaused = simState === 'paused'
  const isDone = simState === 'done'
  const isActive = isRunning || isPaused || isDone
  const controlsLocked = isActive

  const firstPArrivalMs = impactSummary?.firstPArrivalMs ?? null
  const firstSArrivalMs = impactSummary?.firstSArrivalMs ?? null

  return (
    <aside className="earthquake-main-ui">
      <header className="earthquake-main-ui__header">
        <div className="earthquake-main-ui__header-row">
          <div>
            <h1 className="earthquake-main-ui__title">GeoHazard Engine</h1>
            <p className="earthquake-main-ui__subtitle">🌍 지진 — 지진파 전파·진도 분포</p>
          </div>
          <button type="button" className="earthquake-main-ui__reset" onClick={onReset}>
            ↺ 초기화
          </button>
        </div>
      </header>

      <div className="earthquake-main-ui__content">

        {/* 섹션 1: 진원 설정 */}
        <CollapsibleSection title="진원 설정" defaultOpen>
          <div className="earthquake-main-ui__preset-grid">
            {EPICENTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`earthquake-main-ui__preset${epicenter.id === preset.id ? ' earthquake-main-ui__preset--active' : ''}`}
                disabled={controlsLocked}
                onClick={() => onEpicenterChange(preset)}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="earthquake-main-ui__coords">
            <span>위도 {epicenter.lat.toFixed(2)}°</span>
            <span>경도 {epicenter.lon.toFixed(2)}°</span>
          </div>
          <div className="earthquake-main-ui__attrs">
            <span>깊이 {options.depthKm} km</span>
            <span>규모 M {options.magnitude.toFixed(1)}</span>
          </div>
          <button
            type="button"
            className={`earthquake-main-ui__pick${isPickMode ? ' earthquake-main-ui__pick--active' : ''}`}
            disabled={controlsLocked}
            onClick={onPickEpicenter}
          >
            {isPickMode ? '📍 지도에서 클릭…' : '📍 지도에서 선택'}
          </button>
        </CollapsibleSection>

        {/* 섹션 2: 지진 설정 */}
        <CollapsibleSection title="지진 설정" defaultOpen>
          <label className="earthquake-main-ui__field">
            <span className="earthquake-main-ui__field-label">
              규모 (M) <strong>{options.magnitude.toFixed(1)}</strong>
            </span>
            <input
              type="range"
              min="4.0"
              max="8.0"
              step="0.1"
              value={options.magnitude}
              disabled={controlsLocked}
              onChange={(e) => onOptionsChange('magnitude', Number(e.target.value))}
            />
            <span className="earthquake-main-ui__range-labels">
              <span>4.0</span><span>8.0</span>
            </span>
          </label>
          <p className="earthquake-main-ui__hint">{magnitudeHint(options.magnitude)}</p>

          <label className="earthquake-main-ui__field">
            <span className="earthquake-main-ui__field-label">
              진원 깊이 <strong>{options.depthKm} km</strong>
            </span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={options.depthKm}
              disabled={controlsLocked}
              onChange={(e) => onOptionsChange('depthKm', Number(e.target.value))}
            />
            <span className="earthquake-main-ui__range-labels">
              <span>1 km</span><span>60 km</span>
            </span>
          </label>
        </CollapsibleSection>

        {/* 섹션 3: 피해 범위 */}
        <CollapsibleSection title="피해 범위" defaultOpen>
          <ImpactPanel impactSummary={isActive ? impactSummary : null} elapsedMs={elapsedMs} />
        </CollapsibleSection>

        {/* 섹션 4: 시뮬레이션 */}
        <CollapsibleSection title="시뮬레이션" defaultOpen>
          <div className="earthquake-main-ui__actions">
            {isRunning ? (
              <button type="button" className="earthquake-main-ui__action" onClick={onPause}>
                ⏸ 일시정지
              </button>
            ) : (
              <button
                type="button"
                className="earthquake-main-ui__action earthquake-main-ui__action--primary"
                disabled={isDone}
                onClick={onStart}
              >
                {isPaused ? '▶ 재개' : '▶ 시작'}
              </button>
            )}
          </div>

          {isActive && (
            <>
              <EarthquakeSimTimeline
                phase={phase}
                elapsedMs={elapsedMs}
                impactSummary={impactSummary}
                pRadiusM={pRadiusM}
                sRadiusM={sRadiusM}
                totalMs={totalMs}
                firstPArrivalMs={firstPArrivalMs}
                firstSArrivalMs={firstSArrivalMs}
                maxPropagationKm={options.maxPropagationKm}
                shakeAlert={shakeAlert}
              />
              <ScrubBar
                elapsedMs={elapsedMs}
                totalMs={totalMs}
                firstPArrivalMs={firstPArrivalMs}
                firstSArrivalMs={firstSArrivalMs}
                onSeek={onSeek}
              />
            </>
          )}
        </CollapsibleSection>

      </div>
    </aside>
  )
}
