import { Loader2 } from 'lucide-react'
import './TerrainLoadingBadge.css'

export default function TerrainLoadingBadge({ visible }) {
  if (!visible) return null

  return (
    <div className="terrain-loading-badge overlay-surface" role="status" aria-live="polite">
      <Loader2 size={13} strokeWidth={2.25} className="terrain-loading-badge__spinner" aria-hidden="true" />
      지형 고도 정밀화 중
    </div>
  )
}
