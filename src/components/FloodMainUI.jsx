import RainControl from './RainControl'
import WaterLevelControl from './WaterLevelControl'
import SimulationOptions from './SimulationOptions'
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
        <section className="flood-main-ui__section">
          <h2 className="flood-main-ui__section-title">기본 제어</h2>
          <RainControl
            intensity={rainIntensity}
            onIntensityChange={onRainIntensityChange}
            autoAccumulate={autoWaterRise}
            onAutoAccumulateChange={onAutoWaterRiseChange}
          />
          <WaterLevelControl
            waterLevel={waterLevel}
            onWaterLevelChange={onWaterLevelChange}
          />
        </section>

        <section className="flood-main-ui__section">
          <h2 className="flood-main-ui__section-title">시뮬레이션 옵션</h2>
          <SimulationOptions options={simulationOptions} onOptionChange={onOptionChange} />
        </section>
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
