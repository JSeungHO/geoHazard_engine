import { MMI_SCALE, getMMIColor } from '../../../physics/EarthquakeWaveModel'
import './MmiLegend.css'

/**
 * 진도(MMI) 범례 — USGS ShakeMap 색상표.
 */
export default function MmiLegend() {
  return (
    <figure className="mmi-legend overlay-surface" aria-label="수정 메르칼리 진도 범례">
      <figcaption className="mmi-legend__title">
        진도 <span className="mmi-legend__unit">MMI</span>
      </figcaption>
      <div className="mmi-legend__scale">
        {MMI_SCALE.map((step) => (
          <div
            key={step.level}
            className="mmi-legend__cell"
            title={`MMI ${step.label} — 흔들림 ${step.shaking} · 피해 ${step.damage}`}
          >
            <span className="mmi-legend__swatch" style={{ background: getMMIColor(step.level) }} />
            <span className="mmi-legend__label">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="mmi-legend__axis" aria-hidden="true">
        <span>약함</span>
        <span>피해 시작 (VI)</span>
        <span>극심</span>
      </div>
    </figure>
  )
}
