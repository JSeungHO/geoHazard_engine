import './WaterLevelControl.css'
import { waterLevelHint } from '../utils/displayUnits'

export default function WaterLevelControl({ waterLevel, onWaterLevelChange }) {
  return (
    <div className="water-control">
      <label htmlFor="water-slider" className="water-label">
        침수 깊이 — 저지대 기준 (m)
      </label>
      <input
        id="water-slider"
        type="range"
        min="0"
        max="100"
        step="0.01"
        value={waterLevel}
        onChange={(e) => onWaterLevelChange(Number(e.target.value))}
        className="water-slider"
      />
      <span className="water-value">{Number(waterLevel).toFixed(2)} m</span>
      <p className="water-hint">{waterLevelHint(waterLevel)}</p>
    </div>
  )
}
