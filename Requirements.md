# Uniqlo Canada Price Tracker - Frontend Requirements

## Overview
A web application for tracking Uniqlo Canada product prices over time, allowing users to monitor price changes, view price history, and receive notifications for price drops.

---

## Pages

### 1. Home Page / Dashboard

#### Header
- [ ] Logo/Brand name ("Uniqlo Price Tracker" or similar)
- [ ] Global search bar (prominent placement)
- [ ] Navigation links (Home, Categories, About)

#### Search Functionality
- [ ] Search bar with autocomplete suggestions
- [ ] Search by product name
- [ ] Search by product ID
- [ ] Filter options:
  - [ ] Category dropdown (Tops, Outerwear, Bottoms, etc.)
  - [ ] Price range slider
  - [ ] Sort by: Price (Low-High, High-Low), Biggest Discount, Recently Updated

#### Product Grid
- [ ] Responsive grid layout (4 columns desktop, 2 columns tablet, 1 column mobile)
- [ ] Each product card displays:
  - [ ] Product image (thumbnail)
  - [ ] Product name (truncated if too long)
  - [ ] Current price (prominent)
  - [ ] Lowest recorded price (with label "Lowest: $XX.XX")
  - [ ] Price change indicator (up/down arrow with percentage)
  - [ ] "On Sale" badge if current price < original price
  - [ ] "All-Time Low" badge if current price equals lowest price
- [ ] Infinite scroll or pagination
- [ ] Loading skeleton states

#### Statistics Banner (Optional)
- [ ] Total products tracked
- [ ] Products on sale today
- [ ] Average discount percentage

---

### 2. Individual Product Page

#### Product Header
- [ ] Large product image (with zoom capability)
- [ ] Product name (full title)
- [ ] Product ID
- [ ] Category breadcrumb (e.g., Home > Men > Tops)
- [ ] Link to Uniqlo.ca product page (external link)

#### Price Information Panel
- [ ] Current price (large, prominent)
- [ ] Original/regular price (if different, shown with strikethrough)
- [ ] Discount percentage (if on sale)
- [ ] Price statistics:
  - [ ] Lowest price ever recorded
  - [ ] Highest price ever recorded
  - [ ] Average price
  - [ ] Date of lowest price
  - [ ] Date of highest price

#### Interactive Price Graph
- [ ] Line chart showing price history over time
- [ ] Time range selector:
  - [ ] 7 days
  - [ ] 30 days
  - [ ] 90 days
  - [ ] 1 year
  - [ ] All time
- [ ] Hover tooltip showing exact price and date
- [ ] Visual markers for:
  - [ ] Price drops (green)
  - [ ] Price increases (red)
  - [ ] Current price line
  - [ ] Lowest/highest price markers
- [ ] Zoom and pan functionality
- [ ] Option to download chart as image

#### Email Notification Section
- [ ] "Get Price Drop Alerts" call-to-action
- [ ] Email input field
- [ ] Target price input (optional - "Alert me when price drops below $XX")
- [ ] Notification preferences:
  - [ ] Any price drop
  - [ ] Specific price threshold
  - [ ] All-time low only
- [ ] Unsubscribe option (for already subscribed users)
- [ ] Confirmation message on subscription

#### Additional Information
- [ ] Last updated timestamp
- [ ] Price check frequency note
- [ ] Related/similar products section

---

### 3. Search Results Page

- [ ] Search query displayed
- [ ] Result count
- [ ] Same grid layout as home page
- [ ] Filter sidebar (collapsible on mobile)
- [ ] "No results found" state with suggestions

---

### 4. Category Page

- [ ] Category header with description
- [ ] Subcategory filters
- [ ] Product grid (same as home page)

---

## Global Components

### Navigation Bar
- [ ] Sticky header on scroll
- [ ] Logo (links to home)
- [ ] Search bar
- [ ] Category dropdown menu
- [ ] Mobile hamburger menu

### Footer
- [ ] About section
- [ ] Data source disclaimer
- [ ] Last scrape timestamp
- [ ] Contact/feedback link
- [ ] Privacy policy link

### Loading States
- [ ] Skeleton loaders for product cards
- [ ] Spinner for data fetching
- [ ] Progress indicator for search

### Error States
- [ ] Product not found (404)
- [ ] Server error message
- [ ] Network error with retry button

---

## Technical Requirements

### Responsive Design
- [ ] Mobile-first approach
- [ ] Breakpoints:
  - Mobile: < 640px
  - Tablet: 640px - 1024px
  - Desktop: > 1024px

### Performance
- [ ] Lazy loading for images
- [ ] Virtual scrolling for large lists
- [ ] Image optimization (WebP with fallbacks)
- [ ] Code splitting by route

### Accessibility
- [ ] WCAG 2.1 AA compliance
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Sufficient color contrast
- [ ] Alt text for all images

### Browser Support
- [ ] Chrome (last 2 versions)
- [ ] Firefox (last 2 versions)
- [ ] Safari (last 2 versions)
- [ ] Edge (last 2 versions)

---

## Data Requirements

### Product Data
```typescript
interface Product {
  id: string;
  name: string;
  currentPrice: number;
  originalPrice: number;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  lowestPriceDate: string;
  highestPriceDate: string;
  imageUrl: string;
  productUrl: string;
  category: string;
  lastUpdated: string;
}
```

### Price History Data
```typescript
interface PricePoint {
  date: string;
  price: number;
}

interface PriceHistory {
  productId: string;
  history: PricePoint[];
}
```

### Email Subscription Data
```typescript
interface Subscription {
  email: string;
  productId: string;
  targetPrice?: number;
  notificationType: 'any_drop' | 'threshold' | 'all_time_low';
  createdAt: string;
}
```

---

## API Endpoints Needed

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products` | GET | List all products (paginated) |
| `/api/products/:id` | GET | Get single product details |
| `/api/products/:id/history` | GET | Get price history for product |
| `/api/products/search` | GET | Search products by query |
| `/api/categories` | GET | List all categories |
| `/api/categories/:slug` | GET | Get products by category |
| `/api/subscriptions` | POST | Create email subscription |
| `/api/subscriptions/:id` | DELETE | Remove subscription |
| `/api/stats` | GET | Get dashboard statistics |

---

## Future Enhancements (Nice to Have)

- [ ] User accounts with saved watchlists
- [ ] Push notifications (browser)
- [ ] Price comparison with other retailers
- [ ] Price prediction based on historical patterns
- [ ] Dark mode toggle
- [ ] Export price history as CSV
- [ ] Social sharing for deals
- [ ] Browser extension for quick price checks
- [ ] Mobile app (React Native)

---

## Design Preferences

### Color Palette Options
1. **Uniqlo-inspired**: Red (#FF0000) primary, white, gray, black
2. **Neutral/Modern**: Blue primary, clean whites, subtle grays
3. **Minimal**: Black and white with accent color for CTAs

### Typography
- Clean, readable sans-serif fonts
- Clear hierarchy between headings and body text
- Readable price numbers (tabular figures)

### Visual Style
- Clean and minimal
- Focus on product images
- Clear price visibility
- Obvious interactive elements

---

## Notes
- Scraper runs daily at 6:00 AM
- Data source: Uniqlo Canada (uniqlo.com/ca/en)
- Categories tracked: Men's Tops, Outerwear, Sweaters, Shirts, Bottoms, Innerwear, Loungewear, Accessories, Sport Utility Wear
