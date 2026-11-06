/**
 * 범위 슬라이더 — 채움 비율을 CSS 변수(--fill)로 전달해 진행 트랙을 그린다.
 */
export default function Slider({ value, min, max, step = 1, color, className = '', style, ...rest }) {
  const lo = Number(min)
  const hi = Number(max)
  const pct = hi > lo ? ((Number(value) - lo) / (hi - lo)) * 100 : 0
  const fill = `${Math.max(0, Math.min(100, pct))}%`

  return (
    <input
      type="range"
      className={`slider ${className}`.trim()}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ '--fill': fill, ...(color ? { '--slider-color': color } : null), ...style }}
      {...rest}
    />
  )
}
