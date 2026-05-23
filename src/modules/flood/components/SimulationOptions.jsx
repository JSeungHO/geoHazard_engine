import { SIMULATION_OPTION_RANGES } from '../constants/simulationDefaults'
import CollapsibleSection from '../../../components/CollapsibleSection'
import './SimulationOptions.css'

const OPTION_SECTIONS = [
  {
    title: '수위 상승',
    items: [
      {
        key: 'waterRiseSpeed',
        label: '자동 상승 속도 (100% 강수)',
        hint: '강수량 %에 비례해 상승',
        format: (v) => `${v.toFixed(2)} m/s`,
      },
    ],
  },
  {
    title: '파도',
    items: [
      {
        key: 'waveTimeScale',
        label: '파도 속도',
        hint: '높을수록 빠르게 출렁임',
        format: (v) => `${v.toFixed(2)}×`,
      },
      {
        key: 'waveStiffness',
        label: '파도 강성',
        hint: '높을수록 날카로운 파형',
        format: (v) => v.toFixed(2),
      },
      {
        key: 'waveMaxAmplitude',
        label: '파도 최대 높이',
        hint: '수면 출렁임 한계',
        format: (v) => `${v.toFixed(1)} m`,
      },
      {
        key: 'rainImpactStrength',
        label: '강수 파문 강도',
        hint: '비가 수면에 닿을 때 충격',
        format: (v) => v.toFixed(2),
      },
    ],
  },
  {
    title: '반사 / 하이라이트',
    items: [
      {
        key: 'glintStrength',
        label: '햇빛 반짝임',
        hint: '태양 glint 강도',
        format: (v) => `${v.toFixed(2)}×`,
      },
      {
        key: 'reflectivity',
        label: '하늘 반사',
        hint: '프레넬·하늘 거울 반사',
        format: (v) => v.toFixed(2),
      },
    ],
  },
]

function OptionSlider({ optionKey, label, hint, value, format, onChange }) {
  const range = SIMULATION_OPTION_RANGES[optionKey]

  return (
    <div className="sim-option-field">
      <label htmlFor={`opt-${optionKey}`} className="sim-option-label">
        {label}
      </label>
      <input
        id={`opt-${optionKey}`}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => onChange(optionKey, Number(e.target.value))}
        className="sim-option-slider"
      />
      <div className="sim-option-meta">
        <span className="sim-option-value">{format(value)}</span>
        <span className="sim-option-hint">{hint}</span>
      </div>
    </div>
  )
}

export default function SimulationOptions({ options, onOptionChange }) {
  return (
    <div className="sim-options">
      {OPTION_SECTIONS.map((section) => (
        <CollapsibleSection key={section.title} title={section.title} nested>
          {section.items.map((item) => (
            <OptionSlider
              key={item.key}
              optionKey={item.key}
              label={item.label}
              hint={item.hint}
              value={options[item.key]}
              format={item.format}
              onChange={onOptionChange}
            />
          ))}
        </CollapsibleSection>
      ))}
    </div>
  )
}
