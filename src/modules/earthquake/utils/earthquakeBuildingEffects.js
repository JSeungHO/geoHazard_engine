/**
 * earthquakeBuildingEffects.js — OSM 3D Tiles 건물 손상 색상 + 흔들림
 * 참조: earthquake-plan.md Phase 3
 *
 * - Cesium3DTileStyle: S파 도달 반경 기준 거리 밴드 색상 (MMI proxy)
 * - CustomShader: S파 전파 중 건물 vertex 미세 진동 (교육용 근사)
 */

import {
  Cesium3DTileStyle,
  CustomShader,
  UniformType,
} from 'cesium'
import { MMI_COLORS, getShakeParams } from '../../../physics/EarthquakeWaveModel'

const DEG_TO_KM = 111.0
const STYLE_RADIUS_BUCKET_M = 50_000

/** OSM 기본 색상 복원 */
export const DEFAULT_BUILDING_STYLE = new Cesium3DTileStyle({
  color: "Boolean(${feature['cesium#color']}) ? color(${feature['cesium#color']}, 0.92) : color('#b8b8b8', 0.92)",
})

/** 스타일 갱신 키 — MMI layer와 동일 bucket */
export function getBuildingStyleRefreshKey(sRadiusM, magnitude, depthKm) {
  const radiusBucket = Math.floor(sRadiusM / STYLE_RADIUS_BUCKET_M)
  return `${radiusBucket}|${magnitude.toFixed(1)}|${depthKm}`
}

/**
 * S파 반경 기준 건물 손상 색상 스타일
 * cesium#longitude/latitude 메타데이터 사용 (Cesium OSM Buildings)
 */
export function buildBuildingDamageStyle(epicenter, sWaveRadiusKm) {
  const lon = epicenter.lon
  const lat = epicenter.lat
  const r = Math.max(sWaveRadiusKm, 0.001)
  const defaultColor =
    "Boolean(${feature['cesium#color']}) ? color(${feature['cesium#color']}, 0.92) : color('#b8b8b8', 0.92)"

  return new Cesium3DTileStyle({
    defines: {
      distEpicenterKm:
        `distance(vec2(\${feature['cesium#longitude']}, \${feature['cesium#latitude']}), vec2(${lon}, ${lat})) * ${DEG_TO_KM}`,
    },
    color: {
      conditions: [
        [`\${distEpicenterKm} > ${r}`, defaultColor],
        [`\${distEpicenterKm} <= ${r * 0.08}`, `color('${MMI_COLORS[9]}', 0.94)`],
        [`\${distEpicenterKm} <= ${r * 0.18}`, `color('${MMI_COLORS[8]}', 0.92)`],
        [`\${distEpicenterKm} <= ${r * 0.32}`, `color('${MMI_COLORS[7]}', 0.9)`],
        [`\${distEpicenterKm} <= ${r * 0.5}`, `color('${MMI_COLORS[6]}', 0.88)`],
        [`\${distEpicenterKm} <= ${r * 0.68}`, `color('${MMI_COLORS[5]}', 0.86)`],
        [`\${distEpicenterKm} <= ${r * 0.85}`, `color('${MMI_COLORS[4]}', 0.84)`],
        [true, `color('${MMI_COLORS[3]}', 0.82)`],
      ],
    },
  })
}

/** 건물 흔들림 강도 (0~1) — maxMMI + simState 기반 */
export function getBuildingShakeIntensity({ simState, maxMMI, sWaveRadiusM }) {
  if (simState !== 'running') return 0
  if (sWaveRadiusM <= 0 || maxMMI < 5) return 0
  const { intensity } = getShakeParams(maxMMI)
  return intensity * 0.22
}

function ensureBuildingShakeShader(tileset, cache) {
  if (cache.shakeAttached) return

  tileset.customShader = new CustomShader({
    uniforms: {
      u_time: { type: UniformType.FLOAT, value: 0 },
      u_intensity: { type: UniformType.FLOAT, value: 0 },
    },
    vertexShaderText: `
      void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
        if (u_intensity <= 0.001) {
          return;
        }
        float h = max(abs(vsOutput.positionMC.z), 1.0);
        float amp = u_intensity * min(h / 25.0, 2.0);
        float t = u_time;
        vec3 nudge = vec3(
          sin(t * 10.0 + vsOutput.positionMC.x * 0.05),
          cos(t * 12.0 + vsOutput.positionMC.y * 0.05),
          sin(t * 7.0) * 0.35
        ) * amp * 0.18;
        vsOutput.positionMC += nudge;
      }
    `,
  })
  cache.shakeAttached = true
}

function updateBuildingShakeUniforms(tileset, elapsedMs, intensity) {
  const shader = tileset.customShader
  if (!shader?.uniforms) return
  shader.uniforms.u_time.value = elapsedMs / 1000
  shader.uniforms.u_intensity.value = intensity
}

/**
 * OSM tileset 손상·흔들림 동기화
 * @param {import('cesium').Cesium3DTileset} tileset
 * @param {object} options
 * @param {object} [cache]
 */
export function syncBuildingEffects(tileset, options = {}, cache = {}) {
  if (!tileset || tileset.isDestroyed?.()) return

  try {
    const {
      epicenter,
      sWaveRadiusKm = 0,
      sWaveRadiusM = 0,
      magnitude = 6,
      depthKm = 10,
      elapsedMs = 0,
      maxMMI = 0,
      simState = 'idle',
      layerVisible = true,
    } = options

    const shakeIntensity = layerVisible
      ? getBuildingShakeIntensity({ simState, maxMMI, sWaveRadiusM })
      : 0

    if (!layerVisible || !epicenter || sWaveRadiusM <= 0) {
      if (cache.styleKey !== 'default') {
        tileset.style = DEFAULT_BUILDING_STYLE
        cache.styleKey = 'default'
      }
      if (cache.shakeAttached) {
        updateBuildingShakeUniforms(tileset, 0, 0)
      }
      return
    }

    const styleKey = getBuildingStyleRefreshKey(sWaveRadiusM, magnitude, depthKm)
    if (cache.styleKey !== styleKey) {
      tileset.style = buildBuildingDamageStyle(epicenter, sWaveRadiusKm)
      cache.styleKey = styleKey
    }

    if (shakeIntensity > 0) {
      ensureBuildingShakeShader(tileset, cache)
      updateBuildingShakeUniforms(tileset, elapsedMs, shakeIntensity)
    } else if (cache.shakeAttached) {
      updateBuildingShakeUniforms(tileset, 0, 0)
    }
  } catch (err) {
    console.warn('[earthquakeBuildingEffects] sync failed:', err)
  }
}

/** idle/reset — 기본 스타일·shader 제거 */
export function clearBuildingEffects(tileset, cache = {}) {
  if (!tileset || tileset.isDestroyed?.()) {
    cache.styleKey = null
    cache.shakeAttached = false
    return
  }

  try {
    tileset.style = DEFAULT_BUILDING_STYLE
    tileset.customShader = undefined
  } catch (err) {
    console.warn('[earthquakeBuildingEffects] clear failed:', err)
  }
  cache.styleKey = 'default'
  cache.shakeAttached = false
}
