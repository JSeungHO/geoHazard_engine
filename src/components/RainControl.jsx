import './RainControl.css'

export default function RainControl({ intensity, onIntensityChange }) {
  return (
    <div className="rain-control">
      <label htmlFor="rain-slider" className="rain-label">
        강수량 (Rain Intensity)
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
    </div>
  )
}
