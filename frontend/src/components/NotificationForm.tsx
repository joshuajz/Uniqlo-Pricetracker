import { useState } from 'react'
import { Bell, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createSubscription } from '@/lib/api'
import { formatPrice } from '@/lib/utils'

interface NotificationFormProps {
  productId: string
  currentPrice: number
  lowestPrice: number
}

type NotificationType = 'any_drop' | 'threshold' | 'all_time_low'

export function NotificationForm({
  productId,
  currentPrice,
  lowestPrice,
}: NotificationFormProps) {
  const [email, setEmail] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [notificationType, setNotificationType] = useState<NotificationType>('any_drop')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      await createSubscription({
        email,
        productId,
        targetPrice: notificationType === 'threshold' ? parseFloat(targetPrice) : undefined,
        notificationType,
      })
      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-4">
            <div className="rounded-full bg-success/10 p-3 mb-4">
              <Check className="h-6 w-6 text-success" />
            </div>
            <h3 className="font-semibold mb-2">You're subscribed!</h3>
            <p className="text-sm text-muted-foreground">
              We'll email you at {email} when the price drops.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Price Drop Alerts
        </CardTitle>
        <CardDescription>
          Get notified when this product's price drops
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          {/* Notification Type */}
          <div>
            <label className="text-sm font-medium">Notify me when:</label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="notificationType"
                  value="any_drop"
                  checked={notificationType === 'any_drop'}
                  onChange={() => setNotificationType('any_drop')}
                  className="text-primary"
                />
                <span className="text-sm">Any price drop</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="notificationType"
                  value="threshold"
                  checked={notificationType === 'threshold'}
                  onChange={() => setNotificationType('threshold')}
                  className="text-primary"
                />
                <span className="text-sm">Price drops below</span>
                {notificationType === 'threshold' && (
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-24 h-8"
                    step="0.01"
                    min="0"
                    max={currentPrice}
                  />
                )}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="notificationType"
                  value="all_time_low"
                  checked={notificationType === 'all_time_low'}
                  onChange={() => setNotificationType('all_time_low')}
                  className="text-primary"
                />
                <span className="text-sm">
                  New all-time low (current: {formatPrice(lowestPrice)})
                </span>
              </label>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Subscribing...
              </>
            ) : (
              <>
                <Bell className="mr-2 h-4 w-4" />
                Subscribe to Alerts
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
