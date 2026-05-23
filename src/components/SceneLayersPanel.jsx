import { createPortal } from 'react-dom'
import { SCENE_LAYER_DEFS } from '../constants/sceneLayers'
import './SceneLayersPanel.css'

function LayerToggle({ layer, visible, onChange }) {
  return (
    <label className="scene-layer-row">
      <div className="scene-layer-row__info">
        <span className="scene-layer-row__label">{layer.label}</span>
        <span className="scene-layer-row__desc">{layer.description}</span>
      </div>
      <button
        type="button"
        role="switch"
        className={`scene-layer-toggle ${visible ? 'scene-layer-toggle--on' : ''}`}
        aria-checked={visible}
        aria-label={`${layer.label} ${visible ? '표시' : '숨김'}`}
        onClick={() => onChange(layer.id, !visible)}
      >
        <span className="scene-layer-toggle__knob" />
      </button>
    </label>
  )
}

function SceneLayersPanelContent({ layerVisibility, onLayerVisibilityChange, onFlyToGangnam }) {
  return (
    <aside
      className="scene-layers-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 280,
        zIndex: 10000,
        background: '#0f172a',
      }}
    >
      <header className="scene-layers-panel__header">
        <h2 className="scene-layers-panel__title">레이어</h2>
        <p className="scene-layers-panel__subtitle">지도 객체 표시 설정</p>
      </header>

      <div className="scene-layers-panel__content">
        <section className="scene-layers-panel__section">
          <h3 className="scene-layers-panel__section-title">뷰</h3>
          <button
            type="button"
            className="scene-layers-panel__fly-btn"
            onClick={onFlyToGangnam}
          >
            강남역으로 이동
          </button>
        </section>

        <section className="scene-layers-panel__section">
          <h3 className="scene-layers-panel__section-title">3D 객체</h3>
          <div className="scene-layers-panel__list">
            {SCENE_LAYER_DEFS.map((layer) => (
              <LayerToggle
                key={layer.id}
                layer={layer}
                visible={layerVisibility[layer.id]}
                onChange={onLayerVisibilityChange}
              />
            ))}
          </div>
        </section>
      </div>

      <footer className="scene-layers-panel__footer">
        <span className="scene-layers-panel__hint">레이어는 설정 파일에서 추가할 수 있습니다.</span>
      </footer>
    </aside>
  )
}

/** body에 portal로 렌더 — Cesium canvas 위에 항상 표시 */
export default function SceneLayersPanel(props) {
  return createPortal(<SceneLayersPanelContent {...props} />, document.body)
}
