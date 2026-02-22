import type { Product } from '../types'

export const CATEGORIES = ['Tops', 'Bottoms', 'Outerwear', 'Accessories', 'Innerwear'] as const

export const PRODUCTS: Product[] = [
  // Tops
  { id: '473220', name: 'Heattech Turtleneck Sweater', gender: 'W', category: 'Tops',        price: 99.90,  regular_price: 149.90, lowest: 89.90,  hue: 220 },
  { id: '452891', name: 'AIRism Polo Shirt',            gender: 'M', category: 'Tops',        price: 14.90,  regular_price: 24.90,  lowest: 14.90,  hue: 195 },
  { id: '467341', name: 'Flannel Checked Shirt',        gender: 'M', category: 'Tops',        price: 29.90,  regular_price: 39.90,  lowest: 24.90,  hue: 15  },
  { id: '489201', name: 'Soufflé Yarn Knit Sweater',   gender: 'W', category: 'Tops',        price: 49.90,  regular_price: 59.90,  lowest: 44.90,  hue: 280 },
  // Bottoms
  { id: '471823', name: 'Slim-Fit Chino Trousers',     gender: 'M', category: 'Bottoms',     price: 34.90,  regular_price: 49.90,  lowest: 29.90,  hue: 40  },
  { id: '461027', name: 'Ultra Stretch Skinny Jeans',  gender: 'W', category: 'Bottoms',     price: 39.90,  regular_price: 59.90,  lowest: 34.90,  hue: 225 },
  { id: '482934', name: 'Sweat Wide-Fit Trousers',     gender: 'U', category: 'Bottoms',     price: 24.90,  regular_price: 29.90,  lowest: 19.90,  hue: 200 },
  // Outerwear
  { id: '478102', name: 'Light Warm Padded Vest',      gender: 'M', category: 'Outerwear',   price: 49.90,  regular_price: 69.90,  lowest: 44.90,  hue: 30  },
  { id: '465892', name: 'BlockTech Parka',              gender: 'U', category: 'Outerwear',   price: 119.90, regular_price: 149.90, lowest: 99.90,  hue: 210 },
  { id: '491023', name: 'Fleece Full-Zip Jacket',      gender: 'U', category: 'Outerwear',   price: 29.90,  regular_price: 49.90,  lowest: 29.90,  hue: 160 },
  // Accessories
  { id: '455123', name: 'UV Protection Cap',           gender: 'U', category: 'Accessories', price: 14.90,  regular_price: 19.90,  lowest: 12.90,  hue: 350 },
  { id: '469045', name: 'Socks 3-Pack',                gender: 'U', category: 'Accessories', price: 9.90,   regular_price: 14.90,  lowest: 9.90,   hue: 0   },
  { id: '488234', name: 'Mini Shoulder Bag',           gender: 'U', category: 'Accessories', price: 19.90,  regular_price: 29.90,  lowest: 17.90,  hue: 25  },
  { id: '492011', name: 'Knit Beanie',                 gender: 'U', category: 'Accessories', price: 9.90,   regular_price: 14.90,  lowest: 7.90,   hue: 270 },
  // Innerwear
  { id: '463891', name: 'Wireless Bra',                gender: 'W', category: 'Innerwear',   price: 19.90,  regular_price: 29.90,  lowest: 17.90,  hue: 340 },
  { id: '475023', name: 'Heattech Extra Warm L/S',     gender: 'W', category: 'Innerwear',   price: 19.90,  regular_price: 29.90,  lowest: 16.90,  hue: 260 },
]

export const HISTORIES: Record<string, number[]> = {
  '473220': [149.90, 149.90, 139.90, 139.90, 129.90, 119.90, 109.90, 109.90, 99.90, 99.90],
  '452891': [24.90,  24.90,  24.90,  19.90,  19.90,  19.90,  14.90,  14.90,  14.90, 14.90],
  '467341': [39.90,  39.90,  39.90,  34.90,  34.90,  34.90,  29.90,  29.90,  29.90, 29.90],
  '489201': [59.90,  59.90,  54.90,  54.90,  49.90,  49.90,  49.90,  49.90,  49.90, 49.90],
  '471823': [49.90,  49.90,  49.90,  44.90,  44.90,  39.90,  39.90,  34.90,  34.90, 34.90],
  '461027': [59.90,  59.90,  54.90,  49.90,  49.90,  44.90,  44.90,  39.90,  39.90, 39.90],
  '482934': [29.90,  29.90,  29.90,  29.90,  24.90,  24.90,  24.90,  24.90,  24.90, 24.90],
  '478102': [69.90,  69.90,  64.90,  59.90,  59.90,  54.90,  54.90,  49.90,  49.90, 49.90],
  '465892': [149.90, 149.90, 149.90, 139.90, 139.90, 129.90, 129.90, 119.90, 119.90, 119.90],
  '491023': [49.90,  49.90,  44.90,  44.90,  39.90,  39.90,  34.90,  34.90,  29.90, 29.90],
  '455123': [19.90,  19.90,  17.90,  17.90,  16.90,  16.90,  14.90,  14.90,  14.90, 14.90],
  '469045': [14.90,  14.90,  14.90,  12.90,  12.90,  11.90,  9.90,   9.90,   9.90,  9.90],
  '488234': [29.90,  29.90,  29.90,  24.90,  24.90,  24.90,  19.90,  19.90,  19.90, 19.90],
  '492011': [14.90,  14.90,  12.90,  12.90,  12.90,  11.90,  9.90,   9.90,   9.90,  9.90],
  '463891': [29.90,  29.90,  27.90,  24.90,  24.90,  22.90,  22.90,  19.90,  19.90, 19.90],
  '475023': [29.90,  29.90,  29.90,  24.90,  24.90,  24.90,  19.90,  19.90,  19.90, 19.90],
}

export const DATES = ["May '25", "Jun '25", "Jul '25", "Aug '25", "Sep '25", "Oct '25", "Nov '25", "Dec '25", "Jan '26", "Feb '26"]

// Products the mock user is tracking in their dashboard
export const WATCHED_IDS = ['473220', '452891', '461027', '478102', '469045', '465892', '491023', '488234']

export function discountPct(p: Product): number {
  return Math.round((1 - p.price / p.regular_price) * 100)
}

export function isAtl(p: Product): boolean {
  return p.price <= p.lowest
}

export function isOnSale(p: Product): boolean {
  return p.price < p.regular_price
}

export function genderLabel(g: 'M' | 'W' | 'U'): string {
  return g === 'M' ? 'Men' : g === 'W' ? 'Women' : 'Unisex'
}
