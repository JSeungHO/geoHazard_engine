/**
 * 배수망 상태 → 표시 색상·크기 (지도 레이어·범례 공용)
 */

/** 충수 단계 — 범례 순서 */
export const DRAINAGE_LEVELS = [
  { id: 'empty', label: '여유', color: '#5b6b7f', description: '관경 대비 수심 30% 미만' },
  { id: 'flowing', label: '흐름', color: '#4c9aff', description: '수심 30% 이상' },
  { id: 'full', label: '만관', color: '#f5a524', description: '관이 꽉 참 — 압력 흐름' },
  { id: 'overflow', label: '역류', color: '#e5484d', description: '맨홀에서 지표로 넘침' },
]

const COLOR_BY_ID = Object.fromEntries(DRAINAGE_LEVELS.map((l) => [l.id, l.color]))

/** @param {{ fillRatio: number, surcharged: boolean }} link */
export function linkLevel(link) {
  if (link.surcharged) return 'full'
  if (link.fillRatio >= 0.3) return 'flowing'
  return 'empty'
}

/** @param {{ fillRatio: number, surcharged: boolean, overflowing: boolean }} node */
export function nodeLevel(node) {
  if (node.overflowing) return 'overflow'
  if (node.surcharged) return 'full'
  if (node.fillRatio >= 0.15) return 'flowing'
  return 'empty'
}

export const levelColor = (id) => COLOR_BY_ID[id]

/** 관경 → 선 굵기 (px) */
export const linkWidthPx = (diameterM) => Math.max(1.5, Math.min(6, 1 + diameterM * 2))

/** 맨홀 점 크기 (px) */
export const nodeSizePx = (level) => (level === 'overflow' ? 11 : level === 'full' ? 7 : 4)
