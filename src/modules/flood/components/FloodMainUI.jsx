import RainControl, { PondingParamsControl } from './RainControl'
import WaterLevelControl from './WaterLevelControl'
import SimulationOptions from './SimulationOptions'
import ScenarioPanel from './ScenarioPanel'
import CollapsibleSection from '../../../components/CollapsibleSection'
import Panel from '../../../components/ui/Panel'

export default function FloodMainUI({
  rainfallMmH,
  onRainfallChange,
  pondingParams,
  onPondingParamChange,
  autoWaterRise,
  onAutoWaterRiseChange,
  waterLevel,
  onWaterLevelChange,
  simulationOptions,
  onOptionChange,
  onPresetApply,
  onScenarioApply,
  activeScenarioId,
  onReset,
}) {
  return (
    <Panel title="도시 침수" location="서울 강남구 · 강남역 일대" onReset={onReset} label="침수 시뮬레이션 설정">
      <CollapsibleSection title="시나리오" defaultOpen>
        <ScenarioPanel onApply={onScenarioApply} activeScenarioId={activeScenarioId} />
      </CollapsibleSection>

      <CollapsibleSection
        title="강우"
        defaultOpen
        aside={rainfallMmH > 0 ? `${rainfallMmH} mm/h` : null}
      >
        <RainControl
          rainfallMmH={rainfallMmH}
          onRainfallChange={onRainfallChange}
          autoAccumulate={autoWaterRise}
          onAutoAccumulateChange={onAutoWaterRiseChange}
          pondingParams={pondingParams}
        />
      </CollapsibleSection>

      <CollapsibleSection title="수위" defaultOpen aside={`${Number(waterLevel).toFixed(2)} m`}>
        <WaterLevelControl waterLevel={waterLevel} onWaterLevelChange={onWaterLevelChange} />
      </CollapsibleSection>

      <CollapsibleSection title="배수 조건">
        <PondingParamsControl pondingParams={pondingParams} onPondingParamChange={onPondingParamChange} />
      </CollapsibleSection>

      <CollapsibleSection title="수면 표현">
        <SimulationOptions
          options={simulationOptions}
          onOptionChange={onOptionChange}
          onPresetApply={onPresetApply}
        />
      </CollapsibleSection>
    </Panel>
  )
}
