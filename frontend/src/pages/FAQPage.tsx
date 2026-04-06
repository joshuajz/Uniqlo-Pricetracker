import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const FAQS = [
  {
    q: 'What is Uniqlo Tracker?',
    a: 'Uniqlo Tracker tracks Uniqlo prices, duh!',
  },
  {
    q: 'How often are prices updated?',
    a: 'Once per day',
  },
  {
    q: 'How do I add a product to my watchlist?',
    a: 'Watchlists aren\'t made yet',
  },
  {
    q: 'What does "At All-Time Low" (ATL) mean?',
    a: 'all time low',
  },
  {
    q: 'Will I be notified when a price drops?',
    a: 'notifications TBD',
  },
  {
    q: 'Is Uniqlo Tracker affiliated with Uniqlo?',
    a: 'no',
  },
  {
    q: 'Which regions are supported?',
    a: 'Tracks Canadian prices',
  },
  {
    q: 'How do I remove a product from my watchlist?',
    a: 'Unclick the "star", watchlists TBD',
  },
]

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`last:border-b last:border-gray-200 dark:last:border-stone-700 ${index === 0 ? 'border-t-[3px] border-red-600' : 'border-t border-gray-200 dark:border-stone-700'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center py-[18px] bg-transparent border-none cursor-pointer font-sans text-left gap-4"
      >
        <span className="text-[15px] font-semibold text-gray-900 dark:text-stone-100 leading-[1.3]">{q}</span>
        <span className="text-gray-300 dark:text-stone-600 shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="text-sm text-gray-600 dark:text-stone-400 leading-[1.7] pb-5 pr-0 sm:pr-10">
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
        <p className="text-sm text-gray-400 dark:text-stone-500">
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
      <div className="mt-14 border-t-[3px] border-gray-900 dark:border-stone-100 pt-6 flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between sm:items-center">
        <div>
          <div className="text-sm font-semibold mb-1">Still have questions?</div>
          <div className="text-[13px] text-gray-400 dark:text-stone-500">We're happy to help.</div>
        </div>
        <a
          href="mailto:hello@uniqlotracker.com"
          className="px-5 py-[10px] bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[13px] font-semibold tracking-[0.04em] transition-[background,color] duration-150 hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white inline-block"
        >
          Contact Us →
        </a>
      </div>
    </div>
  )
}
