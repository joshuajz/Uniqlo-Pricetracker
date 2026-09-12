import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAnalyticsConsent, PRIVACY_SETTINGS_EVENT, setAnalyticsConsent, type AnalyticsConsent } from '../lib/analytics'

export default function PrivacyConsent() {
  const [choice, setChoice] = useState<AnalyticsConsent>(getAnalyticsConsent)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const open = () => setSettingsOpen(true)
    window.addEventListener(PRIVACY_SETTINGS_EVENT, open)
    return () => window.removeEventListener(PRIVACY_SETTINGS_EVENT, open)
  }, [])

  useEffect(() => {
    if (!settingsOpen) return
    headingRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [settingsOpen])

  const decide = (accepted: boolean) => {
    setAnalyticsConsent(accepted)
    setChoice(accepted ? 'accepted' : 'declined')
    setSettingsOpen(false)
  }

  const copy = <>
    <p>With your permission, we use US-based PostHog to collect pseudonymous page views and interactions, along with browser, device and approximate-location data. We do not record sessions or form text. Declining does not affect the price tracker.</p>
    <Link to="/privacy">Read the privacy policy</Link>
  </>

  if (settingsOpen) return <div className="privacy-backdrop" role="presentation" onClick={(event) => {
    if (event.target === event.currentTarget) setSettingsOpen(false)
  }}>
    <section className="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-settings-title">
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
