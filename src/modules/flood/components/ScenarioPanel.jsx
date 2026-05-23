import { SCENARIOS } from '../constants/scenarios'
import './ScenarioPanel.css'

export default function ScenarioPanel({ onApply }) {
  return (
    <div className="scenario-panel">
      {SCENARIOS.map((scenario) => (
        <button
          key={scenario.id}
          type="button"
          className="scenario-btn"
          onClick={() => onApply(scenario)}
        >
          <span className="scenario-btn__icon" aria-hidden="true">
            {scenario.icon}
          </span>
          <span className="scenario-btn__info">
            <span className="scenario-btn__label">{scenario.label}</span>
            <span className="scenario-btn__desc">{scenario.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
