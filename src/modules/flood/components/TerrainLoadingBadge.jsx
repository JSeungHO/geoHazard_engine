import './TerrainLoadingBadge.css'

export default function TerrainLoadingBadge({ visible }) {
  if (!visible) return null

  return (
    <div className="terrain-loading-badge" role="status" aria-live="polite">
      <span className="terrain-loading-badge__spinner" aria-hidden="true" />
      지형 정밀화 중…
    </div>
  )
}
