import { useEffect, useId, useRef, useState } from 'react'

export default function TypicalHelp() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); button.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  return <span className="typical-help" ref={root}>
    <button ref={button} type="button" aria-label="What does Typical mean?" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}><span aria-hidden="true">?</span></button>
    {open && <span className="typical-explanation" id={id} role="note">
      <strong>Typical tracked price</strong>The price recorded most often across this product’s history. Ties use the higher price. It can change over time and may differ from Uniqlo’s list price or advertised discounts.
    </span>}
  </span>
}
