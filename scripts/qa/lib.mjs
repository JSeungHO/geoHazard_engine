/**
 * QA 스크립트 공통 설정 — 서버 주소, 출력 폴더, 브라우저 기동.
 *
 * 환경 변수
 *   BASE           dev 서버 주소 (기본 http://localhost:5173)
 *   QA_OUT         스크린샷 출력 폴더 (기본 qa-screenshots/, git 미추적)
 *   HEADED=1       브라우저 창을 띄워 실행 (기본 headless)
 *   SLOWMO         동작 사이 지연 ms (기본 0)
 *   CHROMIUM_PATH  사용할 Chromium 실행 파일 경로 (선택)
 */
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'

export const BASE = process.env.BASE ?? 'http://localhost:5173'
export const OUT_DIR = process.env.QA_OUT ?? 'qa-screenshots'
export const VIEWPORT = { width: 1440, height: 900 }

export async function launch() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
    slowMo: Number(process.env.SLOWMO ?? 0),
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  })
  const context = await browser.newContext({ viewport: VIEWPORT })
  const page = await context.newPage()
  return { browser, context, page }
}

/** 첫 방문 안내 오버레이가 떠 있으면 닫는다. */
export async function dismissWelcome(page) {
  const cta = page.locator('.welcome-overlay button', { hasText: '시작하기' })
  if (await cta.count()) await cta.first().click()
}
