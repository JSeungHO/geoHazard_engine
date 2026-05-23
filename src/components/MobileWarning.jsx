import { useState, useEffect } from 'react'
import './MobileWarning.css'

const BREAKPOINT = 1000

export default function MobileWarning() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINT)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < BREAKPOINT)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!isMobile) return null

  return (
    <div className="mobile-warning" role="alertdialog" aria-label="모바일 미지원 안내">
      <div className="mobile-warning__card">
        <div className="mobile-warning__icon" aria-hidden="true">
          🖥
        </div>
        <h2 className="mobile-warning__title">데스크탑 환경에서 이용해 주세요</h2>
        <p className="mobile-warning__body">
          GeoHazard Engine은 1000px 이상 화면에 최적화되어 있습니다.
        </p>
      </div>
    </div>
  )
}
