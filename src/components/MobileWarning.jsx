import { useState, useEffect } from 'react'
import { Monitor } from 'lucide-react'
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
    <div className="mobile-warning" role="alertdialog" aria-labelledby="mobile-warning-title">
      <div className="mobile-warning__card">
        <Monitor size={22} strokeWidth={1.75} className="mobile-warning__icon" aria-hidden="true" />
        <h2 id="mobile-warning-title" className="mobile-warning__title">
          데스크톱 환경에서 이용해 주세요
        </h2>
        <p className="mobile-warning__body">
          3D 지도와 제어 패널을 함께 표시하기 위해 가로 {BREAKPOINT}px 이상의 화면이 필요합니다.
        </p>
      </div>
    </div>
  )
}
