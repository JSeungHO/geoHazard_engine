import { useState } from 'react'
import { ChevronDown, Crosshair, Layers } from 'lucide-react'
import { SCENE_LAYER_DEFS } from '../constants/sceneLayers'
import SwitchRow from './ui/SwitchRow'
import './SceneLayersPanel.css'

/**
 * 지도 우상단 플로팅 레이어 컨트롤 — 지도 컨테이너 내부에 렌더한다.
 */
export default function SceneLayersPanel({
  layerVisibility,
  onLayerVisibilityChange,
  onFlyTo,
  flyToLabel = '기본 시점으로 이동',
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="map-layers overlay-surface">
      <button
        type="button"
        className="map-layers__header"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Layers size={14} strokeWidth={2} aria-hidden="true" />
        <span className="map-layers__title">레이어</span>
        <ChevronDown
          className={`map-layers__chevron${open ? ' map-layers__chevron--open' : ''}`}
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="map-layers__body">
          {SCENE_LAYER_DEFS.map((layer) => (
            <SwitchRow
              key={layer.id}
              label={layer.label}
              description={layer.description}
              checked={Boolean(layerVisibility[layer.id])}
              onChange={(visible) => onLayerVisibilityChange(layer.id, visible)}
            />
          ))}
          {onFlyTo && (
            <button type="button" className="btn btn--block" onClick={onFlyTo}>
              <Crosshair size={13} strokeWidth={2} aria-hidden="true" />
              {flyToLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
