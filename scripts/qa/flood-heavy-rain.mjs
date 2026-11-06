/**
 * 집중호우 시나리오 회귀 검사 — 지형 정밀화 배지가 사라지고 렌더링 오류가 없어야 한다.
 * 실행: npm run qa:flood   (dev 서버 실행 중이어야 함). 실패 시 exit 1.
 */
import { BASE, launch, dismissWelcome } from './lib.mjs'

const errors = []
const logs = []

const { browser, page } = await launch()

page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  const text = msg.text()
  logs.push(`[${msg.type()}] ${text}`)
  if (msg.type() === 'error' || text.includes('[FloodVisualization]') || text.includes('[SimulationErrorBoundary]')) {
    errors.push(text)
  }
})

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(8000)
await dismissWelcome(page)

const heavyRain = page.locator('button.option-row', { hasText: '집중호우' })
await heavyRain.click()
await page.waitForTimeout(8000)

const badgeVisible = await page.locator('.terrain-loading-badge').isVisible().catch(() => false)
const errorOverlay = page.locator('.simulation-error')
const hasError = await errorOverlay.isVisible().catch(() => false)

console.log('--- terrain loading badge visible:', badgeVisible)
console.log('--- simulation error overlay visible:', hasError)
if (hasError) {
  console.log('overlay text:', await errorOverlay.innerText())
}
console.log('--- console errors:', errors.length)
errors.forEach((e) => console.log(e))
console.log('--- recent logs ---')
logs.slice(-30).forEach((l) => console.log(l))

await browser.close()
process.exit(hasError || badgeVisible || errors.length > 0 ? 1 : 0)
