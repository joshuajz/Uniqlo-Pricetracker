import { useMarket } from '../context/MarketContext'
import { marketPath } from '../lib/markets'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAnalyticsConsent, PRIVACY_SETTINGS_EVENT, setAnalyticsConsent, type AnalyticsConsent } from '../lib/analytics'

export default function PrivacyConsent() {
  const market = useMarket()
  const [choice, setChoice] = useState<AnalyticsConsent>(getAnalyticsConsent)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const navigatingToPolicy = useRef(false)

  useEffect(() => {
    const open = () => setSettingsOpen(true)
    window.addEventListener(PRIVACY_SETTINGS_EVENT, open)
    return () => window.removeEventListener(PRIVACY_SETTINGS_EVENT, open)
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    const dialog = dialogRef.current
    if (!dialog) return
    navigatingToPolicy.current = false
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const backdrop = dialog.parentElement
    const background = [...(backdrop?.parentElement?.children ?? [])]
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop)
      .map(element => ({ element, inert: element.inert }))
    const previousOverflow = document.body.style.overflow
    background.forEach(({ element }) => { element.inert = true })
    document.body.style.overflow = 'hidden'
    headingRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSettingsOpen(false)
      }
      if (event.key !== 'Tab') return
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
        .filter(element => element.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) return
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === headingRef.current || !dialog.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      background.forEach(({ element, inert }) => { element.inert = inert })
      document.body.style.overflow = previousOverflow
      if (navigatingToPolicy.current) {
        document.getElementById('main-content')?.focus({ preventScroll: true })
      } else if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [settingsOpen])

  const decide = (accepted: boolean) => {
    setAnalyticsConsent(accepted)
    setChoice(accepted ? 'accepted' : 'declined')
    setSettingsOpen(false)
  }

  const copy = <>
    <p>With your permission, we use US-based PostHog to collect pseudonymous page views and interactions, along with browser, device and approximate-location data. We do not record sessions or form text. Declining does not affect the price tracker.</p>
    <Link to={marketPath(market, '/privacy')} onClick={event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
      navigatingToPolicy.current = true
      setSettingsOpen(false)
    }}>Read the privacy policy</Link>
  </>

  if (settingsOpen) return <div className="privacy-backdrop" role="presentation" onClick={(event) => {
    if (event.target === event.currentTarget) setSettingsOpen(false)
  }}>
    <section ref={dialogRef} className="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-settings-title">
      <button type="button" className="privacy-close" aria-label="Close privacy settings" onClick={() => setSettingsOpen(false)}>
        <X size={20} aria-hidden="true" />
      </button>
      <h2 id="privacy-settings-title" ref={headingRef} tabIndex={-1}>Privacy settings</h2>
      {copy}
      <p className="privacy-current">Current choice: <strong>{choice === 'accepted' ? 'Analytics allowed' : choice === 'declined' ? 'Analytics declined' : 'No choice yet'}</strong></p>
      <div className="privacy-actions">
        <button type="button" className="secondary-button" onClick={() => decide(false)}>Decline analytics</button>
        <button type="button" className="primary-button" onClick={() => decide(true)}>Allow analytics</button>
      </div>
    </section>
  </div>

  if (choice !== null) return null
  return <aside className="privacy-banner" aria-labelledby="privacy-banner-title">
    <div>
      <h2 id="privacy-banner-title">Your privacy choice</h2>
      {copy}
    </div>
    <div className="privacy-actions">
      <button type="button" className="secondary-button" onClick={() => decide(false)}>Decline analytics</button>
      <button type="button" className="primary-button" onClick={() => decide(true)}>Allow analytics</button>
    </div>
  </aside>
}
