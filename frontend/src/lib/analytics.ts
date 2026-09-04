import posthog from 'posthog-js'

export function track(event: string, properties: Record<string, unknown> = {}) {
  if (import.meta.env.PROD && import.meta.env.VITE_PUBLIC_POSTHOG_KEY) posthog.capture(event, properties)
}
