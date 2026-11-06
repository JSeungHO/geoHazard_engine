import { DRAINAGE_LEVELS } from './drainageStyle'
import './drainage.css'

/** 지도 우하단 배수망 범례 */
export default function DrainageLegend() {
  return (
    <figure className="drainage-legend overlay-surface" aria-label="배수망 충수 상태 범례">
      <figcaption className="drainage-legend__title">
        배수망 <span className="drainage-legend__unit">추정</span>
      </figcaption>
      <ul className="drainage-legend__list">
        {DRAINAGE_LEVELS.map((level) => (
          <li key={level.id} className="drainage-legend__item" title={level.description}>
            <span className="drainage-legend__swatch" style={{ background: level.color }} />
            {level.label}
          </li>
        ))}
        <li className="drainage-legend__item" title="빗물이 하천으로 빠져나가는 지점">
          <span className="drainage-legend__swatch drainage-legend__swatch--outfall" />
          방류구
        </li>
      </ul>
    </figure>
  )
}
