import { Info } from 'lucide-react'
import './ModuleShell.css'

function BrandMark() {
  return (
    <svg className="app-bar__mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 20.5c3.2-2.4 6.3-2.4 9.5 0s6.3 2.4 9.5 0" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M5 14.5c3.2-2.4 6.3-2.4 9.5 0s6.3 2.4 9.5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
      <path d="M5 8.5c3.2-2.4 6.3-2.4 9.5 0s6.3 2.4 9.5 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".45" />
      <circle cx="24" cy="25.5" r="2.4" fill="var(--warning)" />
    </svg>
  )
}

export default function ModuleShell({ modules, activeId, onModuleChange, children }) {
  return (
    <div className="module-shell">
      <header className="app-bar">
        <div className="app-bar__brand">
          <BrandMark />
          <span className="app-bar__name">GeoHazard Engine</span>
        </div>

        <nav className="app-bar__nav" aria-label="재난 모듈">
          {modules.map((module) => {
            const isActive = module.id === activeId
            const Icon = module.icon
            return (
              <button
                key={module.id}
                type="button"
                className={`app-bar__tab${isActive ? ' app-bar__tab--active' : ''}`}
                disabled={!module.available}
                aria-current={isActive ? 'page' : undefined}
                title={module.description}
                onClick={() => module.available && onModuleChange(module.id)}
              >
                {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
                {module.label}
                {!module.available && <span className="tag">준비 중</span>}
              </button>
            )
          })}
        </nav>

        <div className="app-bar__end">
          <span
            className="app-bar__disclaimer"
            title="교육·체험용 단순화 모델입니다. 실제 재난 예측·의사결정에 사용할 수 없습니다."
          >
            <Info size={13} strokeWidth={2} aria-hidden="true" />
            교육용 단순화 모델
          </span>
        </div>
      </header>
      <main className="module-shell__main">{children}</main>
    </div>
  )
}
