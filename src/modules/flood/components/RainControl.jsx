import Field from '../../../components/ui/Field'
import SwitchRow from '../../../components/ui/SwitchRow'
import { rainIntensityToMmPerHour } from '../utils/displayUnits'

export default function RainControl({
  intensity,
  onIntensityChange,
  autoAccumulate,
  onAutoAccumulateChange,
}) {
  return (
    <>
      <Field
        id="rain-slider"
        label="강우 강도"
        value={intensity}
        displayValue={intensity > 0 ? `≈ ${rainIntensityToMmPerHour(intensity)}` : '0'}
        unit="mm/h"
        min={0}
        max={100}
        step={1}
        minLabel="0"
        maxLabel={`${rainIntensityToMmPerHour(100)} mm/h`}
        hint={`연출 강도 ${intensity}% 기준 환산값 (교육용 근사)`}
        onChange={onIntensityChange}
      />
      <SwitchRow
        label="강우량 연동 수위 상승"
        description="강우 강도에 비례해 침수 깊이가 자동으로 증가합니다"
        checked={autoAccumulate}
        onChange={onAutoAccumulateChange}
      />
    </>
  )
}
