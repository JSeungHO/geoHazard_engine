import Slider from './Slider'

/**
 * 라벨·값·슬라이더·범위·힌트를 묶은 수치 입력 필드.
 */
export default function Field({
  id,
  label,
  value,
  unit,
  displayValue,
  min,
  max,
  step,
  minLabel,
  maxLabel,
  hint,
  color,
  disabled,
  onChange,
}) {
  return (
    <div className="field">
      <div className="field__row">
        <label htmlFor={id} className="field__label">
          {label}
        </label>
        <span className="field__value">
          {displayValue ?? value}
          {unit && <span className="field__unit">{unit}</span>}
        </span>
      </div>
      <Slider
        id={id}
        value={value}
        min={min}
        max={max}
        step={step}
        color={color}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {(minLabel != null || maxLabel != null) && (
        <div className="field__range" aria-hidden="true">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  )
}
