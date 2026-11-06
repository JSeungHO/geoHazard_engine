import Field from '../../../components/ui/Field'
import { waterLevelHint } from '../utils/displayUnits'
import { MAX_PONDING_DEPTH_M } from '../../../physics/UrbanPondingModel'

export default function WaterLevelControl({ waterLevel, onWaterLevelChange }) {
  return (
    <Field
      id="water-slider"
      label="침수 깊이 (화면 내 최저 지점 기준)"
      value={waterLevel}
      displayValue={Number(waterLevel).toFixed(2)}
      unit="m"
      min={0}
      max={MAX_PONDING_DEPTH_M}
      step={0.05}
      minLabel="0 m"
      maxLabel={`${MAX_PONDING_DEPTH_M} m`}
      hint={`${waterLevelHint(waterLevel)} · 참고: 2022 강남역 실측 0.2~1.8 m`}
      color="var(--data-water)"
      onChange={onWaterLevelChange}
    />
  )
}
