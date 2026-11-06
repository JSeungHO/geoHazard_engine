import { MapPin, RotateCcw } from 'lucide-react'

/**
 * 모듈 좌측 제어 패널 — 헤더(제목·위치·초기화) / 스크롤 본문 / 고정 푸터.
 */
export default function Panel({ title, location, onReset, resetDisabled, footer, children, label }) {
  return (
    <aside className="panel" aria-label={label ?? title}>
      <header className="panel__header">
        <div className="panel__heading">
          <h1 className="panel__title">{title}</h1>
          {location && (
            <p className="panel__meta">
              <MapPin size={12} strokeWidth={2} aria-hidden="true" />
              {location}
            </p>
          )}
        </div>
        {onReset && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onReset}
            disabled={resetDisabled}
            title="모든 설정을 기본값으로 되돌립니다"
          >
            <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
            초기화
          </button>
        )}
      </header>
      <div className="panel__body">{children}</div>
      {footer && <footer className="panel__footer">{footer}</footer>}
    </aside>
  )
}
