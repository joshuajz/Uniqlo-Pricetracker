import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError, requestJSON, shouldRetryRequest } from './api-client.ts'

const response = (status: number) => (async () => new Response(JSON.stringify({ error: 'unavailable' }), { status })) as typeof fetch

test('HTTP errors never become product data; missing IDs fail without repeated retries', async () => {
  await assert.rejects(requestJSON('/missing', new AbortController().signal, 1000, response(404)), error => error instanceof ApiError && error.status === 404)
  assert.equal(shouldRetryRequest(0, new ApiError(404)), false)
  assert.equal(shouldRetryRequest(0, new ApiError(503)), true)
  assert.equal(shouldRetryRequest(2, new ApiError(503)), false)
})

test('a hung request terminates instead of keeping the skeleton forever', async () => {
  const hung = ((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })) as typeof fetch
  await assert.rejects(requestJSON('/hung', new AbortController().signal, 15, hung), { name: 'AbortError' })
})

test('navigation cancellation propagates to the underlying request', async () => {
  const outer = new AbortController()
  let inner: AbortSignal | null = null
  const fetcher = ((_url, options) => new Promise((_resolve, reject) => {
    inner = options?.signal ?? null
    inner?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })) as typeof fetch
  const pending = requestJSON('/product', outer.signal, 1000, fetcher)
  outer.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal((inner as AbortSignal | null)?.aborted, true)
})
