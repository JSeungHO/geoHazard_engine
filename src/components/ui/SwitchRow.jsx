/**
 * 라벨 + 토글 스위치 행. 전체 행이 클릭 영역.
 */
export default function SwitchRow({ label, description, checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch-row"
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-row__text">
        <span className="switch-row__label">{label}</span>
        {description && <span className="switch-row__desc">{description}</span>}
      </span>
      <span className={`switch ${checked ? 'switch--on' : ''}`} aria-hidden="true" />
    </button>
  )
}
