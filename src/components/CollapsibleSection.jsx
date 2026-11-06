import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  nested = false,
  aside,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section className={`section${nested ? ' section--nested' : ''}${open ? ' section--open' : ''}`}>
      <button
        type="button"
        className="section__header"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="section__title">{title}</span>
        {aside != null && <span className="section__aside">{aside}</span>}
        <ChevronDown className="section__chevron" size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <div id={bodyId} className="section__body">
          {children}
        </div>
      )}
    </section>
  )
}
