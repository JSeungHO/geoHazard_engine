import { useState } from 'react'
import './WelcomeOverlay.css'

const STORAGE_KEY = 'geohazard_welcome_dismissed'

export default function WelcomeOverlay() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1'
    } catch {
      return true
    }
  })

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  return (
    <div className="welcome-overlay" role="dialog" aria-labelledby="welcome-title">
      <div className="welcome-overlay__card">
        <h2 id="welcome-title" className="welcome-overlay__title">
          강남역 침수 시뮬레이션
        </h2>
        <p className="welcome-overlay__body">
          강수량을 올리고 수위를 조절해 침수 범위를 확인해 보세요. 수위는 화면 내{' '}
          <strong>저지대 기준 깊이(m)</strong>입니다.
        </p>
        <button type="button" className="welcome-overlay__cta" onClick={dismiss}>
          시작하기
        </button>
      </div>
    </div>
  )
}
