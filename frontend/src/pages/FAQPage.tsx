import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const FAQS = [
  {
    q: 'What is Uniqlo Tracker?',
    a: 'Uniqlo Tracker is a price monitoring tool that tracks Uniqlo product prices over time. We check prices daily and alert you when items you\'re watching drop to new lows or go on sale.',
  },
  {
    q: 'How often are prices updated?',
    a: 'Prices are scraped and updated daily, typically between 2:00–4:00 AM AEST. Price history graphs reflect the last 10 months of data.',
  },
  {
    q: 'How do I add a product to my watchlist?',
    a: 'Browse the product catalogue from the Home or Categories page, then click "Add to Watchlist" on any product. Tracked products appear in your Dashboard with trend graphs and price alerts.',
  },
  {
    q: 'What does "At All-Time Low" (ATL) mean?',
    a: 'ATL means the current price is the lowest we\'ve ever recorded for that product. This is a strong buy signal — historically, prices tend to rise again after hitting a low.',
  },
  {
    q: 'Will I be notified when a price drops?',
    a: 'Email notifications are coming soon. For now, check your Dashboard daily to see price movements on your tracked products.',
  },
  {
    q: 'Is Uniqlo Tracker affiliated with Uniqlo?',
    a: 'No. Uniqlo Tracker is an independent, community-built tool and is not affiliated with, endorsed by, or connected to Uniqlo Co., Ltd. in any way.',
  },
  {
    q: 'Which regions are supported?',
    a: 'Currently we track Australian Uniqlo prices (uniqlo.com/au). Support for other regions is on the roadmap.',
  },
  {
    q: 'How do I remove a product from my watchlist?',
    a: 'Open your Dashboard, find the product you want to remove, and click the remove icon on its row. Changes take effect immediately.',
  },
]

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="faq-item"
      style={{ borderTopColor: index === 0 ? '#dc2626' : '#e8e8e8', borderTopWidth: index === 0 ? 3 : 1 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 0', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left', gap: 16,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.3 }}>{q}</span>
        <span style={{ color: '#bbb', flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{
          fontSize: 14, color: '#555', lineHeight: 1.7,
          paddingBottom: 20, paddingRight: 40,
        }}>
          {a}
        </div>
      )}
    </div>
  )
}

export default function FAQPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Frequently Asked <span style={{ color: '#dc2626' }}>Questions</span>
        </h1>
        <p style={{ fontSize: 14, color: '#888' }}>
          Everything you need to know about Uniqlo Tracker.
        </p>
      </div>

      {/* ── FAQ list ── */}
      <div>
        {FAQS.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} index={i} />
        ))}
      </div>

      {/* ── Contact CTA ── */}
      <div style={{
        marginTop: 56,
        borderTop: '3px solid #111',
        paddingTop: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Still have questions?</div>
          <div style={{ fontSize: 13, color: '#888' }}>We're happy to help.</div>
        </div>
        <a
          href="mailto:hello@uniqlotracker.com"
          style={{
            padding: '10px 20px',
            background: '#111',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            transition: 'background 0.15s',
            display: 'inline-block',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#dc2626')}
          onMouseLeave={e => (e.currentTarget.style.background = '#111')}
        >
          Contact Us →
        </a>
      </div>
    </div>
  )
}
