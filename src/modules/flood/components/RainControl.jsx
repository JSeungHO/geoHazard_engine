import './RainControl.css'
import { rainIntensityToMmPerHour } from '../utils/displayUnits'

export default function RainControl({
  intensity,
  onIntensityChange,
  autoAccumulate,
  onAutoAccumulateChange,
}) {
  const mmPerHour = rainIntensityToMmPerHour(intensity)

  return (
    <div className="rain-control">
      <label htmlFor="rain-slider" className="rain-label">
        강수량 (화면 내 강도)
      </label>
      <input
        id="rain-slider"
        type="range"
        min="0"
        max="100"
        value={intensity}
        onChange={(e) => onIntensityChange(Number(e.target.value))}
        className="rain-slider"
      />
      <span className="rain-value">{intensity}%</span>
      {intensity > 0 && (
        <p className="rain-hint">≈ {mmPerHour} mm/h (교육용 근사치)</p>
      )}

      <button
        type="button"
        className={`rain-toggle ${autoAccumulate ? 'rain-toggle--on' : ''}`}
        onClick={() => onAutoAccumulateChange(!autoAccumulate)}
        aria-pressed={autoAccumulate}
      >
        <span className="rain-toggle-knob" />
        <span className="rain-toggle-label">
          {autoAccumulate ? '강수 → 수위 자동 상승 ON' : '강수 → 수위 자동 상승 OFF'}
        </span>
      </button>
    </div>
  )
}
