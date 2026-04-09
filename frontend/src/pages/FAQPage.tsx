import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import posthog from 'posthog-js'

const FAQS = [
  {
    q: 'What is Uniqlo Price Tracker?',
    a: 'Uniqlo Price Tracker is a free tool that monitors prices across hundreds of Uniqlo Canada products and updates them daily. Our historical data determines whether a product is on sale, and highlgihts items that have hit their \'all time lowest\' price.',
  },
  {
    q: 'How often are prices updated?',
    a: 'Prices are scraped and updated once per day.',
  },
  {
    q: 'Which region does Uniqlo Tracker cover?',
    a: 'Uniqlo Price Tracker currently covers Uniqlo Canada only, as such all products are displayed in CAD (Canadian Dollars).',
  },
  {
    q: 'What does "All-Time Low" (ATL) mean?',
    a: 'The ATL badge appears on products whose current price is the lowest price ever recorded by the tracker (or equal to the previous lowest price ever recorded). It means the item has never been cheaper since we started tracking it, usually meaning it\'s a good time to buy!.',
  },
  {
    q: 'Does Uniqlo Tracker only show sale items?',
    a: 'The home page shows only items that are currently on sale (i.e. selling below their regular price). The Categories page lets you browse all tracked products, including those at full price, so you can monitor items you\'re waiting to go on sale.',
  },
  {
    q: 'Is Uniqlo Tracker affiliated with Uniqlo?',
    a: 'No.',
  },
  {
    q: 'Is there a price alert or notification feature?',
    a: 'Price drop notifications are not available yet, but are planned for a future update. In the meantime, you can check back daily. Please contact us with any other feature requests!',
  },
  {
    q: 'Is Uniqlo Tracker free to use?',
    a: 'Yes, completely free. No account, no sign-up, no subscription required.',
  },
]

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`last:border-b last:border-gray-200 dark:last:border-stone-700 ${index === 0 ? 'border-t-[3px] border-red-600' : 'border-t border-gray-200 dark:border-stone-700'}`}>
      <button
        onClick={() => {
          posthog.capture(open ? 'faq_item_collapsed' : 'faq_item_expanded', { question: q })
          setOpen(o => !o)
        }}
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
          <div className="text-sm font-semibold mb-1">Contact</div>
          <div className="text-[13px] text-gray-400 dark:text-stone-500">Suggest any feature requests or report issues.</div>
        </div>
        <a
          href="https://github.com/joshuajz/Uniqlo-Pricetracker/issues/new?assignees=&labels=triage%2C+needs+triage%2C+bug%2C+feature+request&template=issue_template.md&title=%5BFeature+Request%2FBug%5D+Short+but+descriptive+title"
          onClick={() => posthog.capture('faq_contact_click')}
          className="px-5 py-[10px] bg-gray-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[13px] font-semibold tracking-[0.04em] transition-[background,color] duration-150 hover:bg-red-600 dark:hover:bg-red-600 dark:hover:text-white inline-block"
        >
          Contact Us →
        </a>
      </div>
    </div>
  )
}
