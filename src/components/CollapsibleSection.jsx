import { useState } from 'react'
import './CollapsibleSection.css'

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  nested = false,
  badge,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={`collapse-section ${nested ? 'collapse-section--nested' : ''} ${
        open ? 'collapse-section--open' : ''
      }`}
    >
      <button
        type="button"
        className="collapse-section__header"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="collapse-section__title">{title}</span>
        {badge != null && <span className="collapse-section__badge">{badge}</span>}
        <span className="collapse-section__chevron" aria-hidden />
      </button>
      {open && <div className="collapse-section__body">{children}</div>}
    </section>
  )
}
