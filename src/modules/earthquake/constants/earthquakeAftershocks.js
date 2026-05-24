/**
 * earthquakeAftershocks.js — 여진 시퀀스 계획 (교육용 결정론적)
 * 참조: earthquake-plan.md Phase 4
 */

/** 여진 1회 재생 시간 (ms) */
export const AFTERSHOCK_EVENT_MS = 14_000
/** 여진 간격 (ms) */
export const AFTERSHOCK_GAP_MS = 2_000

const OFFSETS = [
  { dLat: 0.09, dLon: 0.06 },
  { dLat: -0.07, dLon: 0.11 },
  { dLat: 0.05, dLon: -0.08 },
]

/** 본진 규모 기준 여진 개수 */
export function getAftershockCount(magnitude) {
  if (magnitude >= 6.5) return 3
  if (magnitude >= 5.5) return 2
  if (magnitude >= 5.0) return 1
  return 0
}

/**
 * @param {{ lat: number, lon: number }} mainEpicenter
 * @param {number} magnitude
 * @param {number} depthKm
 * @param {number} mainDurationMs
 * @param {boolean} [enabled=true]
 */
export function generateAftershockPlan(mainEpicenter, magnitude, depthKm, mainDurationMs, enabled = true) {
  if (!enabled) return []

  const count = getAftershockCount(magnitude)
  return Array.from({ length: count }, (_, i) => {
    const offset = OFFSETS[i] ?? OFFSETS[0]
    const startMs = mainDurationMs + i * (AFTERSHOCK_EVENT_MS + AFTERSHOCK_GAP_MS)
    return {
      id: `aftershock-${i + 1}`,
      label: `여진 ${i + 1}`,
      lat: mainEpicenter.lat + offset.dLat,
      lon: mainEpicenter.lon + offset.dLon,
      magnitude: Math.max(3.5, magnitude - 0.9 - i * 0.35),
      depthKm,
      startMs,
      endMs: startMs + AFTERSHOCK_EVENT_MS,
      maxPropagationKm: Math.min(380, 100 + magnitude * 28),
      index: i,
    }
  })
}

/** 전체 시뮬레이션 길이 (본진 + 여진) */
export function getTotalSimulationMs(mainDurationMs, plan) {
  if (!plan?.length) return mainDurationMs
  return plan[plan.length - 1].endMs
}

/**
 * 경과 ms → 현재 이벤트
 */
export function resolveSimulationEvent(elapsedMs, mainEpicenter, mainOptions, plan, mainDurationMs) {
  const {
    magnitude: mainMag,
    depthKm: mainDepth,
    timeScale,
    maxPropagationKm: mainMaxKm,
  } = mainOptions

  if (elapsedMs <= mainDurationMs) {
    return {
      type: 'main',
      epicenter: mainEpicenter,
      magnitude: mainMag,
      depthKm: mainDepth,
      maxPropagationKm: mainMaxKm,
      timeScale,
      eventElapsedMs: elapsedMs,
      aftershock: null,
    }
  }

  for (const ash of plan) {
    if (elapsedMs >= ash.startMs && elapsedMs < ash.endMs) {
      return {
        type: 'aftershock',
        epicenter: { lat: ash.lat, lon: ash.lon, id: ash.id, label: ash.label },
        magnitude: ash.magnitude,
        depthKm: ash.depthKm,
        maxPropagationKm: ash.maxPropagationKm,
        timeScale,
        eventElapsedMs: elapsedMs - ash.startMs,
        aftershock: ash,
      }
    }
  }

  return {
    type: 'complete',
    epicenter: mainEpicenter,
    magnitude: mainMag,
    depthKm: mainDepth,
    maxPropagationKm: mainMaxKm,
    timeScale,
    eventElapsedMs: 0,
    aftershock: null,
  }
}

/** plan 생성 헬퍼 */
export function buildAftershockPlan(mainEpicenter, mainOptions, mainDurationMs) {
  const { aftershocksEnabled = true, magnitude, depthKm } = mainOptions
  return generateAftershockPlan(
    mainEpicenter,
    magnitude,
    depthKm,
    mainDurationMs,
    aftershocksEnabled,
  )
}
