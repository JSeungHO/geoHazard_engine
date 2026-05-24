import { describe, it, expect } from 'vitest'
import {
  generateAftershockPlan,
  getAftershockCount,
  getTotalSimulationMs,
  resolveSimulationEvent,
  AFTERSHOCK_EVENT_MS,
} from './earthquakeAftershocks'

const EPICENTER = { lat: 35.76, lon: 129.19, id: 'gyeongju' }
const OPTIONS = {
  magnitude: 5.8,
  depthKm: 15,
  timeScale: 50,
  maxPropagationKm: 800,
  aftershocksEnabled: true,
}

describe('getAftershockCount', () => {
  it('M 5.8 → 2회', () => {
    expect(getAftershockCount(5.8)).toBe(2)
  })

  it('M 4.9 → 0회', () => {
    expect(getAftershockCount(4.9)).toBe(0)
  })
})

describe('generateAftershockPlan', () => {
  const mainDuration = 20_000

  it('disabled → 빈 배열', () => {
    expect(generateAftershockPlan(EPICENTER, 5.8, 15, mainDuration, false)).toEqual([])
  })

  it('여진 magnitude는 본진보다 작다', () => {
    const plan = generateAftershockPlan(EPICENTER, 5.8, 15, mainDuration)
    plan.forEach((ash) => {
      expect(ash.magnitude).toBeLessThan(5.8)
    })
  })

  it('total duration = 마지막 여진 endMs', () => {
    const plan = generateAftershockPlan(EPICENTER, 6.5, 15, mainDuration)
    expect(getTotalSimulationMs(mainDuration, plan)).toBe(plan[plan.length - 1].endMs)
  })
})

describe('resolveSimulationEvent', () => {
  const mainDuration = 10_000
  const plan = generateAftershockPlan(EPICENTER, 5.8, 15, mainDuration)

  it('elapsed < mainDuration → main', () => {
    const ev = resolveSimulationEvent(5_000, EPICENTER, OPTIONS, plan, mainDuration)
    expect(ev.type).toBe('main')
    expect(ev.eventElapsedMs).toBe(5_000)
  })

  it('여진 구간 → aftershock', () => {
    const t = plan[0].startMs + 1_000
    const ev = resolveSimulationEvent(t, EPICENTER, OPTIONS, plan, mainDuration)
    expect(ev.type).toBe('aftershock')
    expect(ev.aftershock?.id).toBe('aftershock-1')
  })

  it('모든 여진 종료 후 → complete', () => {
    const t = plan[plan.length - 1].endMs + 100
    const ev = resolveSimulationEvent(t, EPICENTER, OPTIONS, plan, mainDuration)
    expect(ev.type).toBe('complete')
  })
})

describe('AFTERSHOCK_EVENT_MS', () => {
  it('양수', () => {
    expect(AFTERSHOCK_EVENT_MS).toBeGreaterThan(0)
  })
})
