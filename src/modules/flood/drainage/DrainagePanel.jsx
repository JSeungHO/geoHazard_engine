import { AlertTriangle, Info, Loader2 } from 'lucide-react'
import './drainage.css'
import Field from '../../../components/ui/Field'
import SwitchRow from '../../../components/ui/SwitchRow'

const fmtVolume = (m3) => (m3 >= 10_000 ? `${(m3 / 10_000).toFixed(1)}만 m³` : `${Math.round(m3).toLocaleString('ko-KR')} m³`)

const STATUS_TEXT = {
  loading: '배수망 데이터 불러오는 중',
  sampling: '맨홀 지면 고도 샘플링 중',
}

/**
 * 침수 패널의 배수망 섹션 — 상태 요약·표시 토글·파라미터
 */
export default function DrainagePanel({ visible, onVisibleChange, status, summary, params, onParamChange }) {
  const state = status?.state

  if (state === 'unavailable' || state === 'error') {
    return (
      <div className="notice notice--warning">
        <AlertTriangle size={13} strokeWidth={2} color="var(--warning)" aria-hidden="true" />
        <span>{status.message}</span>
      </div>
    )
  }

  const ready = state === 'ready'
  const s = summary

  return (
    <>
      <SwitchRow
        label="배수망 표시"
        description="도로 아래 관로·맨홀의 충수 상태를 지도에 표시합니다"
        checked={visible}
        onChange={onVisibleChange}
      />

      {!ready && (
        <p className="field__hint" role="status">
          <Loader2 size={12} strokeWidth={2.25} className="drainage-spin" aria-hidden="true" /> {STATUS_TEXT[state] ?? '준비 중'}
        </p>
      )}

      {ready && s && (
        <div className="kv">
          <div className="kv__cell">
            <span className="kv__label">만관 관로</span>
            <span className="kv__value">{s.fullLinks.toLocaleString('ko-KR')} / {s.linkCount.toLocaleString('ko-KR')}</span>
          </div>
          <div className="kv__cell">
            <span className="kv__label">역류 맨홀</span>
            <span className="kv__value" style={s.overflowingManholes > 0 ? { color: 'var(--danger)' } : undefined}>
              {s.overflowingManholes.toLocaleString('ko-KR')}개
            </span>
          </div>
          <div className="kv__cell">
            <span className="kv__label">역류량</span>
            <span className="kv__value">{s.overflowRateM3s.toFixed(2)} m³/s</span>
          </div>
          <div className="kv__cell">
            <span className="kv__label">지표 담수</span>
            <span className="kv__value">{fmtVolume(s.surfaceVolumeM3)}</span>
          </div>
        </div>
      )}

      <Field
        id="drainage-clogging"
        label="빗물받이 막힘률"
        value={Math.round(params.inletClogging * 100)}
        unit="%"
        min={0}
        max={90}
        step={5}
        hint="낙엽·쓰레기로 막힌 빗물받이 비율 — 막힐수록 관로에 들어가지 못한 물이 도로에 남습니다"
        onChange={(v) => onParamChange('inletClogging', v / 100)}
      />
      <Field
        id="drainage-design-rain"
        label="관로 설계 강우"
        value={params.designRainMmH}
        unit="mm/h"
        min={50}
        max={120}
        step={5}
        hint="이 강도를 만관으로 흘릴 수 있도록 관경을 정합니다 — 바꾸면 관망을 다시 설계합니다"
        onChange={(v) => onParamChange('designRainMmH', v)}
      />

      <p className="notice">
        <Info size={13} strokeWidth={2} aria-hidden="true" />
        <span>
          실제 관로 자료가 공개되지 않아 도로 중심선을 관로로 가정한 <strong>추정 배수망</strong>입니다.
          {status?.meta && ` 맨홀 ${status.meta.manholes.toLocaleString('ko-KR')}개 · 관로 ${status.meta.links.toLocaleString('ko-KR')}개 · 최대 관경 ${status.meta.maxDiameterM.toFixed(1)} m.`}
          {status?.meta?.attribution && ` ${status.meta.attribution}`}
        </span>
      </p>
    </>
  )
}
