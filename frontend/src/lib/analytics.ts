import type { PostHog } from 'posthog-js'

export type AnalyticsConsent = 'accepted' | 'declined' | null

const CONSENT_KEY = 'uniqlo-tracker-analytics-consent-v1'
export const PRIVACY_SETTINGS_EVENT = 'uniqlo-tracker:open-privacy-settings'

let initialized = false
let posthog: PostHog | undefined
let loading: Promise<boolean> | null = null

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'accepted' || value === 'declined' ? value : null
  } catch {
    return null
  }
}

export function initializeAnalytics(): Promise<boolean> {
  if (getAnalyticsConsent() !== 'accepted' || !import.meta.env.PROD || !import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return Promise.resolve(false)
  if (initialized) return Promise.resolve(true)
  if (loading) return loading
  loading = import('posthog-js').then(module => {
    // Consent may have been withdrawn while the optional download was pending.
    if (getAnalyticsConsent() !== 'accepted') return false
    posthog = module.default
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
  }).catch(() => false).finally(() => { loading = null })
  return loading
}

export function setAnalyticsConsent(accepted: boolean) {
  try { localStorage.setItem(CONSENT_KEY, accepted ? 'accepted' : 'declined') } catch { /* Consent still applies for this page. */ }
  if (accepted) {
    if (initialized) posthog?.opt_in_capturing({ captureEventName: false })
    track('$pageview')
  } else if (initialized) {
    posthog?.opt_out_capturing()
  }
}

export function track(event: string, properties: Record<string, unknown> = {}) {
  if (getAnalyticsConsent() !== 'accepted') return
  void initializeAnalytics().then(ready => {
    if (ready && getAnalyticsConsent() === 'accepted') posthog?.capture(event, properties)
  })
}
