import Field from '../../../components/ui/Field'
import SwitchRow from '../../../components/ui/SwitchRow'
import { RAINFALL_MAX_MMH } from '../utils/displayUnits'
import { PONDING_PARAM_RANGES } from '../constants/simulationDefaults'
import {
  FLOOD_TIME_SCALE,
  getFloodingThresholdMmH,
  getPondingRateMPerHour,
} from '../../../physics/UrbanPondingModel'

const fmtRate = (rate) => `${rate >= 0 ? '+' : '−'}${Math.abs(rate).toFixed(2)} m/h`

export default function RainControl({
  rainfallMmH,
  onRainfallChange,
  autoAccumulate,
  onAutoAccumulateChange,
  pondingParams,
}) {
  const threshold = getFloodingThresholdMmH(pondingParams)
  const rate = getPondingRateMPerHour(rainfallMmH, pondingParams)

  return (
    <>
      <Field
        id="rain-slider"
        label="강우 강도"
        value={rainfallMmH}
        unit="mm/h"
        min={0}
        max={RAINFALL_MAX_MMH}
        step={1}
        minLabel="0"
        maxLabel={`${RAINFALL_MAX_MMH} mm/h`}
        hint={`침수 시작 임계 ${threshold.toFixed(0)} mm/h (배수능 ÷ 유출계수)`}
        onChange={onRainfallChange}
      />
      <SwitchRow
        label="강우-배수 모델로 수위 계산"
        description={`유입량이 배수능을 넘는 만큼 수위가 오릅니다 · ×${FLOOD_TIME_SCALE} 배속`}
        checked={autoAccumulate}
        onChange={onAutoAccumulateChange}
      />
      {autoAccumulate && (
        <div className="kv">
          <div className="kv__cell">
            <span className="kv__label">수위 변화율</span>
            <span className="kv__value">{rate > 0 || rainfallMmH > 0 ? fmtRate(rate) : '—'}</span>
          </div>
          <div className="kv__cell">
            <span className="kv__label">배수 상태</span>
            <span className="kv__value">{rainfallMmH > threshold ? '배수능 초과' : '처리 가능'}</span>
          </div>
        </div>
      )}
    </>
  )
}

/** 배수 모델 파라미터 — 시뮬레이션 옵션 섹션에서 사용 */
export function PondingParamsControl({ pondingParams, onPondingParamChange }) {
  const { drainageCapacityMmH, runoffCoefficient } = PONDING_PARAM_RANGES
  return (
    <>
      <Field
        id="ponding-drainage"
        label="유효 배수능"
        value={pondingParams.drainageCapacityMmH}
        unit="mm/h"
        {...drainageCapacityMmH}
        hint="하수관로·빗물받이가 실제로 처리하는 강우 강도"
        onChange={(v) => onPondingParamChange('drainageCapacityMmH', v)}
      />
      <Field
        id="ponding-runoff"
        label="유출계수"
        value={pondingParams.runoffCoefficient}
        displayValue={pondingParams.runoffCoefficient.toFixed(2)}
        {...runoffCoefficient}
        hint="강우 중 지표로 흘러드는 비율 (도시 상업지역 0.70~0.95)"
        onChange={(v) => onPondingParamChange('runoffCoefficient', v)}
      />
    </>
  )
}
