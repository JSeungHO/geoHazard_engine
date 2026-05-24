/**
 * cameraShake.js — Cesium postUpdate 기반 카메라 흔들림
 * 참조: earthquake-plan.md §8
 *
 * S파 ring이 카메라 위치에 도달하는 순간 발동.
 * 스크러빙(seekMs 점프) 시에는 외부에서 호출하지 않아야 함.
 */

import { Math as CesiumMath } from 'cesium'

/**
 * 카메라 쉐이크 시작
 * @param {import('cesium').Viewer} viewer
 * @param {number} intensity  0.0 ~ 1.0 (MMI 기반)
 * @param {number} [durationMs=3000]  지속 시간 ms
 * @returns {() => void}  중단 함수 — unmount 시 호출
 */
export function startCameraShake(viewer, intensity, durationMs = 3_000) {
  if (!viewer || viewer.isDestroyed?.()) return () => {}

  const clampedIntensity = Math.max(0, Math.min(1, intensity))
  const startTime = performance.now()

  /** 최대 각도 오프셋 (degree) */
  const MAX_OFFSET_DEG = clampedIntensity * 0.003
  /** 진동 주파수 근사 (Hz) */
  const FREQ = 8 + clampedIntensity * 12
  const durationSec = durationMs / 1000

  let removed = false

  function shake() {
    if (removed) return
    const viewer_ = viewer
    if (!viewer_ || viewer_.isDestroyed?.()) return

    const t = (performance.now() - startTime) / 1000
    const envelope = Math.max(0, 1 - t / durationSec)

    if (envelope <= 0) {
      viewer_.scene.postUpdate.removeEventListener(shake)
      removed = true
      return
    }

    const dx = Math.sin(FREQ * t * 2 * Math.PI) * MAX_OFFSET_DEG * envelope
    const dy = Math.cos(FREQ * t * 1.7 * Math.PI) * MAX_OFFSET_DEG * envelope * 0.6

    const c = viewer_.camera
    c.setView({
      orientation: {
        heading: c.heading + CesiumMath.toRadians(dx),
        pitch: c.pitch + CesiumMath.toRadians(dy),
        roll: c.roll,
      },
    })
  }

  viewer.scene.postUpdate.addEventListener(shake)

  return () => {
    if (!removed) {
      if (!viewer.isDestroyed?.()) {
        viewer.scene.postUpdate.removeEventListener(shake)
      }
      removed = true
    }
  }
}

/**
 * MMI 기반 shakeParams → startCameraShake 래퍼
 * @param {import('cesium').Viewer} viewer
 * @param {{ intensity: number, durationMs: number }} params  getShakeParams() 반환값
 * @returns {() => void}  중단 함수
 */
export function startCameraShakeFromParams(viewer, params) {
  return startCameraShake(viewer, params.intensity, params.durationMs)
}
