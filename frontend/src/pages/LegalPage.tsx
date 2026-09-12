import { Link } from 'react-router-dom'

const EFFECTIVE_DATE = 'September 11, 2026'

function PrivacyPolicy() {
  return <article className="legal-page page-container">
    <header>
      <p className="legal-eyebrow">Legal</p>
      <h1>Privacy policy</h1>
      <p>Effective {EFFECTIVE_DATE}</p>
    </header>

    <div className="legal-summary" aria-labelledby="privacy-summary-title">
      <h2 id="privacy-summary-title">The short version</h2>
      <p>You can use the price tracker without an account. Optional PostHog analytics stay off unless you allow them. We do not sell personal information, use it for targeted advertising, or earn affiliate commissions from product links.</p>
    </div>

    <section>
      <h2>What this policy covers</h2>
      <p>This policy explains how Uniqlo Price Tracker (the “Service”, “we”, “us” or “our”) handles information when you use uniqlotracker.com. It does not cover UNIQLO or any other website you visit through an external link.</p>
    </section>

    <section>
      <h2>Information handled when you visit</h2>
      <h3>Basic request information</h3>
      <p>Like most websites, our website and API hosting providers receive information needed to deliver and secure the Service. This may include your IP address, requested page or file, date and time, referring page, browser and device type, and diagnostic or security logs.</p>
      <h3>Device-only preferences</h3>
      <p>Your browser may store your light or dark theme, search and filter state, scroll position, and analytics choice. These settings support the features you request and normally stay on your device. You can remove them through your browser settings, although doing so may reset your preferences and ask for your analytics choice again.</p>
      <h3>Optional PostHog analytics</h3>
      <p>If you select “Allow analytics”, we use PostHog to measure pseudonymous page views and feature interactions. The data may include a random browser identifier, pages viewed, buttons or filters used, timestamps, referring page, browser and device details, and approximate location derived from an IP address.</p>
      <p>PostHog is a US-based service provider. Analytics information may be processed and stored in the United States and may be available to US authorities under applicable US law. We have configured PostHog not to use session replay, automatic click or form capture, heatmaps, performance monitoring, exception capture, surveys, or person profiles.</p>
    </section>

    <section>
      <h2>Why we use information</h2>
      <p>We use basic request information to deliver the Service, prevent abuse, diagnose failures and protect its security. If you consent, we use analytics to understand which pages and features are useful and to improve reliability and usability.</p>
    </section>

    <section>
      <h2>Consent and your choices</h2>
      <p>Analytics are optional and remain off until you opt in. Declining does not limit the price tracker. You can change or withdraw your choice at any time using “Privacy settings” in the footer. Withdrawal stops future analytics collection from that browser; it does not automatically delete information already collected.</p>
      <p>You can also limit browser storage in your browser settings. Global Privacy Control or Do Not Track signals are honoured by the analytics configuration where supported.</p>
    </section>

    <section>
      <h2>Sharing and service providers</h2>
      <p>We do not sell or rent personal information. We disclose limited information to providers that help host, deliver, secure and measure the Service, including Vercel for the website and PostHog for optional analytics. We may also disclose information when required by law, to protect legal rights or safety, or in connection with a reorganization of the Service, subject to applicable law.</p>
      <p>The site currently loads fonts from Google Fonts. Your browser may send Google basic request information such as your IP address, browser details and the requested font files. Google handles that information under its own privacy terms.</p>
    </section>

    <section>
      <h2>Retention and safeguards</h2>
      <p>We keep personal information only as long as reasonably necessary for the purposes described above, legal obligations, security and dispute resolution. Retention periods may differ for hosting logs and optional analytics. We use reasonable technical and organizational safeguards, but no internet service or storage system can be guaranteed completely secure.</p>
    </section>

    <section>
      <h2>Your privacy rights</h2>
      <p>Depending on the law that applies to you, you may have rights to ask whether we hold personal information about you and to request access, correction, deletion, or withdrawal of consent. Because the Service has no accounts and analytics are pseudonymous, we may be unable to connect a record to you without additional information from your browser.</p>
      <p>For now, use the <Link to="/faq">issue-reporting option on the FAQ page</Link> to request a private contact method. Do not place personal or sensitive information in a public GitHub issue.</p>
    </section>

    <section>
      <h2>Children</h2>
      <p>The Service is a general-audience price comparison tool and is not directed to children under 13. We do not knowingly ask children to provide personal information.</p>
    </section>

    <section>
      <h2>Changes to this policy</h2>
      <p>We may update this policy as the Service or applicable requirements change. We will post the revised policy here and update the effective date. If a change materially affects optional analytics, we will request consent again where required.</p>
    </section>

    <p className="legal-related">Also read our <Link to="/terms">Terms of Service</Link>.</p>
  </article>
}

function TermsOfService() {
  return <article className="legal-page page-container">
    <header>
      <p className="legal-eyebrow">Legal</p>
      <h1>Terms of service</h1>
      <p>Effective {EFFECTIVE_DATE}</p>
    </header>

    <div className="legal-summary" aria-labelledby="terms-summary-title">
      <h2 id="terms-summary-title">Important</h2>
      <p>This is an independent informational service, not a retailer. Prices, availability and product details can be delayed, incomplete or wrong. Always confirm the final price and purchase terms with UNIQLO before buying.</p>
    </div>

    <section>
      <h2>Acceptance</h2>
      <p>These Terms govern your use of Uniqlo Price Tracker (the “Service”). By accessing or using the Service, you agree to these Terms and the <Link to="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Service.</p>
    </section>

    <section>
      <h2>What the Service provides</h2>
      <p>The Service records publicly displayed UNIQLO Canada prices and presents historical comparisons. “Typical tracked price”, “lowest recorded” and discount labels refer only to observations collected by the Service after tracking began. They are not necessarily UNIQLO’s list price, ordinary selling price, advertised discount, or the lowest price available from any seller.</p>
      <p>The Service does not sell products, process payments, guarantee inventory, track every size or colour, or form part of any purchase contract. Your purchase, delivery, return, warranty and account relationship is solely with the retailer.</p>
    </section>

    <section>
      <h2>Independence and links</h2>
      <p>Uniqlo Price Tracker is independent and is not affiliated with, authorized, sponsored or endorsed by UNIQLO Co., Ltd., UNIQLO Canada Inc., or their affiliates. UNIQLO and related names, marks, product names and images belong to their respective owners.</p>
      <p>Product links are provided for convenience. They are not affiliate links, and we do not receive a commission when you follow a link or make a purchase. Third-party sites have their own terms, prices, privacy practices and security; we do not control or accept responsibility for them.</p>
    </section>

    <section>
      <h2>Permitted use</h2>
      <p>You may use the Service for lawful, personal and non-commercial price research. You must not interfere with the Service, bypass access or security controls, introduce malicious code, make requests that unreasonably burden the Service, misrepresent your relationship with us, or use the Service in a way that violates applicable law or another person’s rights.</p>
    </section>

    <section>
      <h2>Accuracy and availability</h2>
      <p>We aim to update prices daily, but do not promise that any information is accurate, complete, current or continuously available. Scraping, source changes, network problems, data processing and human error may cause omissions or incorrect results. A displayed price is not an offer, price guarantee, financial recommendation or promise that an item can be purchased at that price.</p>
      <p>We may correct information, change or remove features, suspend access, or discontinue the Service at any time.</p>
    </section>

    <section>
      <h2>Disclaimer of warranties</h2>
      <p>To the maximum extent permitted by law, the Service is provided “as is” and “as available”, without warranties or conditions of any kind, whether express, implied or statutory, including accuracy, availability, merchantability, fitness for a particular purpose and non-infringement. Nothing in these Terms excludes a warranty or right that cannot lawfully be excluded.</p>
    </section>

    <section>
      <h2>Limitation of liability</h2>
      <p>To the maximum extent permitted by law, we will not be liable for indirect, incidental, special, consequential, exemplary or punitive damages, lost savings, lost profits, lost data, or losses arising from reliance on pricing or availability information, third-party websites, or inability to use the Service. These limitations do not apply where liability cannot lawfully be limited or excluded.</p>
    </section>

    <section>
      <h2>Changes and severability</h2>
      <p>We may update these Terms by posting a revised version and changing the effective date. Your continued use after a change means the revised Terms apply from that point forward. If any provision is found unenforceable, the remaining provisions continue to apply to the fullest extent permitted by law. A failure to enforce a provision is not a waiver.</p>
    </section>

    <p className="legal-related">Also read our <Link to="/privacy">Privacy Policy</Link>.</p>
  </article>
}

export default function LegalPage({ document }: { document: 'privacy' | 'terms' }) {
  return document === 'privacy' ? <PrivacyPolicy /> : <TermsOfService />
}
