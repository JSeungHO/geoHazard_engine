import RainControl from './RainControl'
import WaterLevelControl from './WaterLevelControl'
import SimulationOptions from './SimulationOptions'
import CollapsibleSection from './CollapsibleSection'
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
}) {
  return (
    <aside className="flood-main-ui">
      <header className="flood-main-ui__header">
        <h1 className="flood-main-ui__title">GeoHazard Engine</h1>
        <p className="flood-main-ui__subtitle">강남역 침수 · 강수 시뮬레이션</p>
      </header>

      <div className="flood-main-ui__content">
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
          <SimulationOptions options={simulationOptions} onOptionChange={onOptionChange} />
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
