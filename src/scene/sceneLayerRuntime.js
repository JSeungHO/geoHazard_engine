import { createOsmBuildingsAsync } from 'cesium'

/** @typedef {import('cesium').Viewer} Viewer */

/**
 * @typedef {object} SceneLayerRuntime
 * @property {(viewer: Viewer) => Promise<object>} load
 * @property {(instance: object, visible: boolean) => void} setVisible
 * @property {(viewer: Viewer, instance: object) => void} destroy
 */

/** @type {Record<string, SceneLayerRuntime>} */
export const SCENE_LAYER_RUNTIME = {
  osmBuildings: {
    async load(viewer) {
      const tileset = await createOsmBuildingsAsync()
      viewer.scene.primitives.add(tileset)
      return tileset
    },
    setVisible(tileset, visible) {
      tileset.show = visible
    },
    destroy(viewer, tileset) {
      if (!viewer.isDestroyed?.()) {
        viewer.scene.primitives.remove(tileset)
      }
      if (!tileset.isDestroyed?.()) {
        tileset.destroy()
      }
    },
  },
}
