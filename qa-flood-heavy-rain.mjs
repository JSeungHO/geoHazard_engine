import { chromium } from 'playwright'

const errors = []
const logs = []

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  const text = msg.text()
  logs.push(`[${msg.type()}] ${text}`)
  if (msg.type() === 'error' || text.includes('[FloodVisualization]') || text.includes('[SimulationErrorBoundary]')) {
    errors.push(text)
  }
})

await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(8000)

const heavyRain = page.locator('button.scenario-btn', { hasText: '집중호우' })
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
