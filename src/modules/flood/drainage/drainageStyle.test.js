import { describe, expect, it } from 'vitest'
import { DRAINAGE_LEVELS, levelColor, linkLevel, linkWidthPx, nodeLevel } from './drainageStyle.js'

describe('drainageStyle', () => {
  it('관로: 만관 > 흐름 > 여유', () => {
    expect(linkLevel({ fillRatio: 1, surcharged: true })).toBe('full')
    expect(linkLevel({ fillRatio: 0.5, surcharged: false })).toBe('flowing')
    expect(linkLevel({ fillRatio: 0.1, surcharged: false })).toBe('empty')
  })

  it('맨홀: 역류가 가장 우선', () => {
    expect(nodeLevel({ fillRatio: 1, surcharged: true, overflowing: true })).toBe('overflow')
    expect(nodeLevel({ fillRatio: 0.6, surcharged: true, overflowing: false })).toBe('full')
  })

  it('모든 단계에 색상이 있다', () => {
    for (const l of DRAINAGE_LEVELS) expect(levelColor(l.id)).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('관경이 클수록 굵게, 상·하한 유지', () => {
    expect(linkWidthPx(2)).toBeGreaterThan(linkWidthPx(0.6))
    expect(linkWidthPx(10)).toBe(6)
    expect(linkWidthPx(0)).toBe(1.5)
  })
})
