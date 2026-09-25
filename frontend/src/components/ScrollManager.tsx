import { splitMarketPath } from '../lib/markets'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const positions = new Map<string, number>()
try {
  const saved = JSON.parse(sessionStorage.getItem('uniqlo-scroll') ?? '[]')
  if (Array.isArray(saved)) for (const [key, value] of saved) {
    if (typeof key === 'string' && typeof value === 'number' && value >= 0) positions.set(key, value)
  }
} catch { /* Scroll restoration also works without browser storage. */ }

function save() {
  try { sessionStorage.setItem('uniqlo-scroll', JSON.stringify([...positions].slice(-100))) } catch { /* Storage is optional. */ }
}

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation()
  const previousPath = useRef(pathname)
  const browseScroll = useRef(0)
  const params = new URLSearchParams(search)
  // Legacy modal links, loading more results, or changing their presentation must not move the page.
  for (const key of ['modal', 'limit', 'view']) params.delete(key)
  params.sort()
  // Filters change the result set in place; they should not trigger a scroll restoration.
  // Deals and All products also share one continuous browsing position.
  const browsing = ['/', '/categories'].includes(splitMarketPath(pathname).path)
  const page = browsing ? `${splitMarketPath(pathname).market?.code}:browse` : pathname + '?' + params.toString()
  useEffect(() => {
    const previous = history.scrollRestoration
    history.scrollRestoration = 'manual'
    return () => { history.scrollRestoration = previous }
  }, [])
  useLayoutEffect(() => {
    const previous = previousPath.current
    previousPath.current = pathname
    const isBrowse = (path: string) => ['/', '/categories'].includes(splitMarketPath(path).path)
    let frame = 0
    if (previous !== pathname && isBrowse(previous) && isBrowse(pathname)) {
      const target = browseScroll.current
      frame = requestAnimationFrame(() => window.scrollTo(0, target))
    }
    return () => {
      cancelAnimationFrame(frame)
      if (isBrowse(pathname)) browseScroll.current = window.scrollY
    }
  }, [pathname])
  useLayoutEffect(() => {
    let pending = true
    const target = positions.get(page) ?? 0
    const observer = new ResizeObserver(restore)
    function restore() {
      if (!pending) return
      if (hash) {
        let anchorId = hash.slice(1)
        try { anchorId = decodeURIComponent(anchorId) } catch { /* Invalid escape sequences are literal IDs. */ }
        const anchor = document.getElementById(anchorId)
        if (!anchor) return
        anchor.scrollIntoView()
      } else {
        if (document.documentElement.scrollHeight - innerHeight < target) return
        window.scrollTo(0, target)
      }
      pending = false
      observer.disconnect()
    }
    function record() { if (!pending) positions.set(page, window.scrollY) }
    function takeOver() { pending = false; observer.disconnect(); record() }
    function pageHide() { record(); save() }
    observer.observe(document.body)
    const frame = requestAnimationFrame(restore)
    window.addEventListener('scroll', record, { passive: true })
    window.addEventListener('wheel', takeOver, { passive: true })
    window.addEventListener('touchstart', takeOver, { passive: true })
    window.addEventListener('pagehide', pageHide)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      // The next route may already have shortened the document and clamped scrollY.
      // Keep the last scroll event from this page instead of overwriting it during teardown.
      save()
      window.removeEventListener('scroll', record)
      window.removeEventListener('wheel', takeOver)
      window.removeEventListener('touchstart', takeOver)
      window.removeEventListener('pagehide', pageHide)
    }
  }, [page, hash])
  return null
}
