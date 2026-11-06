import { SCENARIOS } from '../constants/scenarios'
import { rainIntensityToMmPerHour } from '../utils/displayUnits'

export default function ScenarioPanel({ onApply, activeScenarioId = null }) {
  return (
    <div className="option-list" role="radiogroup" aria-label="침수 시나리오">
      {SCENARIOS.map((scenario) => {
        const isActive = activeScenarioId === scenario.id
        return (
          <button
            key={scenario.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`option-row${isActive ? ' option-row--active' : ''}`}
            onClick={() => onApply(scenario)}
          >
            <span className="option-row__main">
              <span className="option-row__title">{scenario.label}</span>
              <span className="option-row__desc">{scenario.description}</span>
            </span>
            <span className="option-row__meta">
              <span>{rainIntensityToMmPerHour(scenario.rain)} mm/h</span>
              <span>{scenario.autoRise ? '수위 자동' : `${scenario.water.toFixed(1)} m`}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
