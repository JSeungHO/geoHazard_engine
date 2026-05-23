import { Color, Event, buildModuleUrl, defined } from 'cesium'

/**
 * Cesium Water fabric material for animated flood surfaces.
 * @see https://github.com/CesiumGS/cesium/blob/main/Source/Scene/Material.js
 */
export class FloodWaterMaterialProperty {
  constructor(options = {}) {
    this._definitionChanged = new Event()
    this._baseWaterColor =
      options.baseWaterColor ?? Color.fromBytes(20, 110, 210, 175)
    this._blendColor = options.blendColor ?? Color.fromBytes(90, 190, 245, 130)
    this._frequency = options.frequency ?? 900
    this._animationSpeed = options.animationSpeed ?? 0.045
    this._amplitude = options.amplitude ?? 3.5
    this._specularIntensity = options.specularIntensity ?? 0.55
    this._normalMap = buildModuleUrl('Assets/Textures/waterNormals.jpg')
    this._specularMap = buildModuleUrl('Assets/Textures/waterNormalsSmall.jpg')
  }

  get isConstant() {
    return false
  }

  get definitionChanged() {
    return this._definitionChanged
  }

  getType() {
    return 'Water'
  }

  getValue(_time, result) {
    if (!defined(result)) {
      result = {}
    }
    result.baseWaterColor = this._baseWaterColor
    result.blendColor = this._blendColor
    result.specularMap = this._specularMap
    result.normalMap = this._normalMap
    result.frequency = this._frequency
    result.animationSpeed = this._animationSpeed
    result.amplitude = this._amplitude
    result.specularIntensity = this._specularIntensity
    return result
  }

  equals(other) {
    return other instanceof FloodWaterMaterialProperty
  }
}
