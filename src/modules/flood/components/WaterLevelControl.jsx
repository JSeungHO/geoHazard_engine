import Field from '../../../components/ui/Field'
import { waterLevelHint } from '../utils/displayUnits'

export default function WaterLevelControl({ waterLevel, onWaterLevelChange }) {
  return (
    <Field
      id="water-slider"
      label="침수 깊이 (화면 내 최저 지점 기준)"
      value={waterLevel}
      displayValue={Number(waterLevel).toFixed(2)}
      unit="m"
      min={0}
      max={100}
      step={0.01}
      minLabel="0 m"
      maxLabel="100 m"
      hint={waterLevelHint(waterLevel)}
      color="var(--data-water)"
      onChange={onWaterLevelChange}
    />
  )
}
