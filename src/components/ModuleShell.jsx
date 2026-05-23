import './ModuleShell.css'

export default function ModuleShell({ modules, activeId, onModuleChange, children }) {
  return (
    <div className="module-shell">
      <nav className="module-shell__nav" aria-label="재난 모듈">
        {modules.map((module) => {
          const isActive = module.id === activeId
          return (
            <button
              key={module.id}
              type="button"
              className={`module-shell__tab ${isActive ? 'module-shell__tab--active' : ''}`}
              disabled={!module.available}
              aria-current={isActive ? 'page' : undefined}
              title={module.description}
              onClick={() => module.available && onModuleChange(module.id)}
            >
              {module.label}
              {!module.available && (
                <span className="module-shell__badge" aria-hidden="true">
                  준비 중
                </span>
              )}
            </button>
          )
        })}
      </nav>
      <main className="module-shell__main">{children}</main>
    </div>
  )
}
