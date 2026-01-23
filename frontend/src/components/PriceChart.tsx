import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice, formatDate } from '@/lib/utils'
import type { PriceDatapoint } from '@/types'

interface PriceChartProps {
  datapoints: PriceDatapoint[]
  lowestPrice: number
  highestPrice: number
  currentPrice: number
}

export function PriceChart({
  datapoints,
  lowestPrice,
  highestPrice,
  currentPrice,
}: PriceChartProps) {
  const chartData = datapoints.map((point) => ({
    datetime: point.datetime,
    price: point.price,
    formattedDate: formatDate(point.datetime),
  }))

  const minPrice = Math.min(...datapoints.map((p) => p.price)) * 0.95
  const maxPrice = Math.max(...datapoints.map((p) => p.price)) * 1.05

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Price History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                domain={[minPrice, maxPrice]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
                className="text-muted-foreground"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="text-sm font-medium">
                          {formatPrice(data.price)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.formattedDate}
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              {/* Lowest price reference line */}
              <ReferenceLine
                y={lowestPrice}
                stroke="hsl(142 76% 36%)"
                strokeDasharray="5 5"
                label={{
                  value: `Lowest: ${formatPrice(lowestPrice)}`,
                  position: 'right',
                  fill: 'hsl(142 76% 36%)',
                  fontSize: 10,
                }}
              />
              {/* Highest price reference line */}
              <ReferenceLine
                y={highestPrice}
                stroke="hsl(0 84% 60%)"
                strokeDasharray="5 5"
                label={{
                  value: `Highest: ${formatPrice(highestPrice)}`,
                  position: 'right',
                  fill: 'hsl(0 84% 60%)',
                  fontSize: 10,
                }}
              />
              {/* Current price reference line */}
              <ReferenceLine
                y={currentPrice}
                stroke="hsl(240 5.9% 10%)"
                strokeDasharray="3 3"
              />
              <Line
                type="stepAfter"
                dataKey="price"
                stroke="hsl(0 84% 60%)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: 'hsl(0 84% 60%)',
                  stroke: 'white',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
