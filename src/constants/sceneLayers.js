/** @typedef {{ id: string, label: string, description: string, defaultVisible: boolean }} SceneLayerDef */

/** @type {SceneLayerDef[]} */
export const SCENE_LAYER_DEFS = [
  {
    id: 'osmBuildings',
    label: 'OSM 건물',
    description: 'OpenStreetMap 3D Buildings (Cesium Ion)',
    defaultVisible: true,
  },
]

export const DEFAULT_LAYER_VISIBILITY = Object.fromEntries(
  SCENE_LAYER_DEFS.map((layer) => [layer.id, layer.defaultVisible])
)

export const getSceneLayerDef = (id) => SCENE_LAYER_DEFS.find((layer) => layer.id === id)
