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
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-overlay__card overlay-surface">
        <p className="welcome-overlay__eyebrow">도시 침수 시뮬레이션</p>
        <h2 id="welcome-title" className="welcome-overlay__title">
          강남역 일대 저지대 침수 범위 체험
        </h2>
        <ol className="welcome-overlay__steps">
          <li>
            <span className="welcome-overlay__step-no">1</span>
            좌측 패널에서 시나리오를 고르거나 강우 강도(mm/h)를 조절합니다.
          </li>
          <li>
            <span className="welcome-overlay__step-no">2</span>
            침수 깊이는 화면에 보이는 영역의 최저 지점을 기준으로 계산됩니다.
          </li>
          <li>
            <span className="welcome-overlay__step-no">3</span>
            2022 강남역 시나리오에서는 서울시 침수흔적도를 함께 표시합니다.
          </li>
        </ol>
        <p className="welcome-overlay__note">
          저지대를 하나의 저류조로 본 단순화 모델입니다. 강우·배수능 차이로 수위를 계산하며, 관로 흐름과
          지표 유하 경로는 반영하지 않습니다.
        </p>
        <div className="welcome-overlay__actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={dismiss}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  )
}
