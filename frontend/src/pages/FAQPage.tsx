import { track } from '../lib/analytics'
import { useLocation } from 'react-router-dom'

const FAQS = [
  { id: 'about', q: 'What is Uniqlo Price Tracker?', a: 'A free tool for comparing Uniqlo Canada prices with their recorded history. Browse deals, check past prices, and find items at their lowest recorded price.' },
  { id: 'updates', q: 'How often are prices updated?', a: 'We check prices daily. The recording date appears above the results and in product details. Prices and availability can change between updates, so confirm the final price on Uniqlo.' },
  { id: 'region', q: 'Which region and currency does it cover?', a: 'Uniqlo Canada only. All prices are in CAD (Canadian dollars).' },
  { id: 'price-comparisons', q: 'How are deals and typical tracked prices calculated?', a: 'The typical tracked price is the most frequently recorded price for a product across its history. When two prices occur equally often, we use the higher one. Deals are below that price, and discount percentages compare the current recorded price with it. This baseline can change as more prices are recorded; it may differ from Uniqlo’s list price or advertised promotions.' },
  { id: 'lowest-recorded', q: 'What does “Lowest recorded” mean?', a: 'The current recorded price is equal to or below every earlier observation, and is below the typical tracked price. We show the tracking start date in product details. Prices before tracking began are unknown. A new product with no lower observation is described as “No lower price recorded yet”; that alone does not establish a deal.' },
  { id: 'all-products', q: 'Can I search products that aren’t discounted?', a: 'Yes. Choose All products to search the whole current catalog, including products at or above their typical price. Deals shows only products below their typical tracked price. Search and filters carry over when switching between these views.' },
  { id: 'availability', q: 'Are all sizes and colours available at the recorded price?', a: 'We track the product’s displayed price. We do not track availability for every size or colour. Choose “Check sizes on Uniqlo” to confirm availability and the final price.' },
  { id: 'affiliation', q: 'Is this affiliated with Uniqlo?', a: 'No. This is an independent price tracker and is not affiliated with Uniqlo Co., Ltd.' },
  { id: 'alerts', q: 'Can I receive price-drop notifications?', a: 'Notifications are not available yet. You can bookmark a product’s price-history link and check back for daily updates.' },
  { id: 'free', q: 'Is it free to use?', a: 'Yes. No account, sign-up or subscription is required.' },
]

export default function FAQPage() {
  const { hash } = useLocation()
  return <div className="faq-page page-container">
    <header><h1>Frequently asked <span>questions</span></h1><p>How prices, history and availability work.</p></header>
    <div className="faq-list">{FAQS.map(item => <details key={item.id} id={item.id} open={hash === `#${item.id}`}
      onToggle={event => track(event.currentTarget.open ? 'faq_item_expanded' : 'faq_item_collapsed', { question: item.q })}>
      <summary>{item.q}</summary><p>{item.a}</p>
    </details>)}</div>
    <div className="contact-section"><div><h2>Something to improve?</h2><p>Report an issue or suggest a feature. A GitHub account is required.</p></div>
      <a className="primary-button" href="https://github.com/joshuajz/Uniqlo-Pricetracker/issues/new?assignees=&labels=triage%2C+needs+triage%2C+bug%2C+feature+request&template=issue_template.md&title=%5BFeature+Request%2FBug%5D+Short+but+descriptive+title"
        target="_blank" rel="noopener noreferrer" onClick={() => track('faq_contact_click')}>Report an issue on GitHub ↗</a>
    </div>
  </div>
}
