interface PriceSparklineProps {
  prices: number[]
  width?: number
  height?: number
  color?: string
  showArea?: boolean
}

export default function PriceSparkline({
  prices,
  width = 80,
  height = 32,
  color = '#dc2626',
  showArea = false,
}: PriceSparklineProps) {
  if (!prices || prices.length < 2) return null

  const pad = 3
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const pts = prices.map((v, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return { x: +x.toFixed(1), y: +y.toFixed(1) }
  })

  const polylinePoints = pts.map(p => `${p.x},${p.y}`).join(' ')
  const areaPath = `M 0,${height} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${width},${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {showArea && (
        <path d={areaPath} fill={color} fillOpacity={0.08} />
      )}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Current price dot */}
      <circle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        r={2.5}
        fill={color}
      />
    </svg>
  )
}
