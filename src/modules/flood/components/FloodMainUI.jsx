import RainControl from './RainControl'
import WaterLevelControl from './WaterLevelControl'
import SimulationOptions from './SimulationOptions'
import ScenarioPanel from './ScenarioPanel'
import CollapsibleSection from '../../../components/CollapsibleSection'
import Panel from '../../../components/ui/Panel'
import { rainIntensityToMmPerHour } from '../utils/displayUnits'

export default function FloodMainUI({
  rainIntensity,
  onRainIntensityChange,
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
        aside={rainIntensity > 0 ? `${rainIntensityToMmPerHour(rainIntensity)} mm/h` : null}
      >
        <RainControl
          intensity={rainIntensity}
          onIntensityChange={onRainIntensityChange}
          autoAccumulate={autoWaterRise}
          onAutoAccumulateChange={onAutoWaterRiseChange}
        />
      </CollapsibleSection>

      <CollapsibleSection title="수위" defaultOpen aside={`${Number(waterLevel).toFixed(2)} m`}>
        <WaterLevelControl waterLevel={waterLevel} onWaterLevelChange={onWaterLevelChange} />
      </CollapsibleSection>

      <CollapsibleSection title="시뮬레이션 옵션">
        <SimulationOptions
          options={simulationOptions}
          onOptionChange={onOptionChange}
          onPresetApply={onPresetApply}
        />
      </CollapsibleSection>
    </Panel>
  )
}
