import RainControl from './RainControl'
import WaterLevelControl from './WaterLevelControl'
import SimulationOptions from './SimulationOptions'
import ScenarioPanel from './ScenarioPanel'
import CollapsibleSection from '../../../components/CollapsibleSection'
import './FloodMainUI.css'

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
    <aside className="flood-main-ui">
      <header className="flood-main-ui__header">
        <div className="flood-main-ui__header-row">
          <div>
            <h1 className="flood-main-ui__title">GeoHazard Engine</h1>
            <p className="flood-main-ui__subtitle">강남역 침수 · 강수 시뮬레이션</p>
          </div>
          <button type="button" className="flood-main-ui__reset" onClick={onReset}>
            초기화
          </button>
        </div>
      </header>

      <div className="flood-main-ui__content">
        <CollapsibleSection title="📋 시나리오" defaultOpen>
          <ScenarioPanel onApply={onScenarioApply} activeScenarioId={activeScenarioId} />
        </CollapsibleSection>

        <CollapsibleSection title="강수" defaultOpen badge={`${rainIntensity}%`}>
          <RainControl
            intensity={rainIntensity}
            onIntensityChange={onRainIntensityChange}
            autoAccumulate={autoWaterRise}
            onAutoAccumulateChange={onAutoWaterRiseChange}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="수위"
          defaultOpen
          badge={`${Number(waterLevel).toFixed(2)} m`}
        >
          <WaterLevelControl
            waterLevel={waterLevel}
            onWaterLevelChange={onWaterLevelChange}
          />
        </CollapsibleSection>

        <CollapsibleSection title="시뮬레이션 옵션">
          <SimulationOptions
            options={simulationOptions}
            onOptionChange={onOptionChange}
            onPresetApply={onPresetApply}
          />
        </CollapsibleSection>
      </div>

      <footer className="flood-main-ui__footer">
        <div className="flood-main-ui__stat">
          <span className="flood-main-ui__stat-label">강수</span>
          <span className="flood-main-ui__stat-value">{rainIntensity}%</span>
        </div>
        <div className="flood-main-ui__stat">
          <span className="flood-main-ui__stat-label">수위</span>
          <span className="flood-main-ui__stat-value">{Number(waterLevel).toFixed(2)} m</span>
        </div>
      </footer>
    </aside>
  )
}
