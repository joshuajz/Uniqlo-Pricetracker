import posthog from 'posthog-js'

export type AnalyticsConsent = 'accepted' | 'declined' | null

const CONSENT_KEY = 'uniqlo-tracker-analytics-consent-v1'
export const PRIVACY_SETTINGS_EVENT = 'uniqlo-tracker:open-privacy-settings'

let initialized = false

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch {
    return null
  }
}

export function initializeAnalytics() {
  if (initialized || getAnalyticsConsent() !== 'accepted' || !import.meta.env.PROD || !import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return false
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_REVERSE_PROXY,
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: '2025-05-24',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_performance: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    person_profiles: 'never',
    respect_dnt: true,
  })
  initialized = true
  return true
}

export function setAnalyticsConsent(accepted: boolean) {
  try { localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'declined') } catch { /* Consent still applies for this page. */ }
  if (accepted) {
    if (initialized) posthog.opt_in_capturing({ captureEventName: false })
    else initializeAnalytics()
  } else if (initialized) {
    posthog.opt_out_capturing()
  }
}

export function track(event: string, properties: Record<string, unknown> = {}) {
  if (initialized && getAnalyticsConsent() === 'accepted') posthog.capture(event, properties)
}
