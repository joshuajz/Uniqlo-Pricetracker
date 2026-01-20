import { formatDate } from '@/lib/utils'

interface FooterProps {
  lastScraped?: string
}

export function Footer({ lastScraped }: FooterProps) {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="font-semibold mb-3">About</h3>
            <p className="text-sm text-muted-foreground">
              Uniqlo Price Tracker helps you monitor prices on Uniqlo Canada products
              and get notified when prices drop.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold mb-3">Links</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://www.uniqlo.com/ca/en/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Uniqlo Canada
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Data Info */}
          <div>
            <h3 className="font-semibold mb-3">Data</h3>
            <p className="text-sm text-muted-foreground">
              Prices are checked daily at 6:00 AM EST.
            </p>
            {lastScraped && (
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {formatDate(lastScraped)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Uniqlo Price Tracker. Not affiliated with Uniqlo.
          </p>
        </div>
      </div>
    </footer>
  )
}
