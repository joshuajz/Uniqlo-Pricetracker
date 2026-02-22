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
    <div className={`last:border-b last:border-gray-200 ${index === 0 ? 'border-t-[3px] border-red-600' : 'border-t border-gray-200'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center py-[18px] bg-transparent border-none cursor-pointer font-sans text-left gap-4"
      >
        <span className="text-[15px] font-semibold text-gray-900 leading-[1.3]">{q}</span>
        <span className="text-gray-300 shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="text-sm text-gray-600 leading-[1.7] pb-5 pr-0 sm:pr-10">
          {a}
        </div>

      )}
    </div>
  )
}

export default function FAQPage() {
  return (
    <div className="max-w-[720px] mx-auto px-4 sm:px-6 pt-10 pb-20">

      {/* ── Header ── */}
      <div className="mb-12">
        <h1 className="text-[26px] sm:text-[36px] font-black tracking-[-0.03em] mb-2">
          Frequently Asked <span className="text-red-600">Questions</span>
        </h1>
        <p className="text-sm text-gray-400">
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
      <div className="mt-14 border-t-[3px] border-gray-900 pt-6 flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between sm:items-center">
        <div>
          <div className="text-sm font-semibold mb-1">Still have questions?</div>
          <div className="text-[13px] text-gray-400">We're happy to help.</div>
        </div>
        <a
          href="mailto:hello@uniqlotracker.com"
          className="px-5 py-[10px] bg-gray-900 text-white text-[13px] font-semibold tracking-[0.04em] transition-[background] duration-150 hover:bg-red-600 inline-block"
        >
          Contact Us →
        </a>
      </div>
    </div>
  )
}
