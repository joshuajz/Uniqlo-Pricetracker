import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CopyLink({ url }: { url: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle')
  return <span className="copy-link-control">
    <button type="button" className="copy-link" onClick={async () => {
      try { await navigator.clipboard.writeText(url); setStatus('copied') }
      catch { setStatus('manual') }
    }}>{status === 'copied' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}<span>{status === 'copied' ? 'Link copied' : 'Copy link'}</span></button>
    <span className="sr-only" role="status">{status === 'copied' ? 'Product link copied to clipboard.' : status === 'manual' ? 'Copy the product link from the field below.' : ''}</span>
    {status === 'manual' && <label className="copy-link-fallback">Product link<input value={url} readOnly onFocus={event => event.target.select()} /></label>}
  </span>
}
