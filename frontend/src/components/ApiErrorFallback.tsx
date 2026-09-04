export default function ApiErrorFallback({ onRetry }: { onRetry: () => void }) {
  return <div className="empty-state" role="alert"><h3>We couldn’t load prices</h3>
    <p>Check your connection and try again.</p><button type="button" className="primary-button" onClick={onRetry}>Retry loading prices</button>
  </div>
}
