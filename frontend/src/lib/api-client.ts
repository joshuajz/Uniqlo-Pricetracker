export class ApiError extends Error {
  status: number
  constructor(status: number) {
    super(`Request failed (${status})`)
    this.status = status
  }
}

export const shouldRetryRequest = (attempt: number, error: Error) => attempt < 2
  && (!(error instanceof ApiError) || error.status >= 500 || error.status === 429)

export async function requestJSON<T>(url: string, signal: AbortSignal, timeoutMs = 15000, fetcher = fetch): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const timeout = setTimeout(abort, timeoutMs)
  try {
    const response = await fetcher(url, { signal: controller.signal })
    if (!response.ok) throw new ApiError(response.status)
    return await response.json()
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}
