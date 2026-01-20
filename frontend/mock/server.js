const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Load mock data
const products = require('./data/products.json');
const priceHistory = require('./data/priceHistory.json');
const categories = require('./data/categories.json');
const stats = require('./data/stats.json');

// In-memory subscriptions store
const subscriptions = [];

// Helper function for pagination
function paginate(array, page = 1, limit = 12) {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total: array.length,
      totalPages: Math.ceil(array.length / limit),
      hasNext: endIndex < array.length,
      hasPrev: page > 1
    }
  };
}

// GET /api/stats - Dashboard statistics
app.get('/api/stats', (req, res) => {
  res.json(stats);
});

// GET /api/products - List all products (paginated)
app.get('/api/products', (req, res) => {
  const { page = 1, limit = 12, sort, category, minPrice, maxPrice } = req.query;

  let filteredProducts = [...products];

  // Filter by category
  if (category) {
    filteredProducts = filteredProducts.filter(p => p.category === category);
  }

  // Filter by price range
  if (minPrice) {
    filteredProducts = filteredProducts.filter(p => p.currentPrice >= parseFloat(minPrice));
  }
  if (maxPrice) {
    filteredProducts = filteredProducts.filter(p => p.currentPrice <= parseFloat(maxPrice));
  }

  // Sort products
  if (sort) {
    switch (sort) {
      case 'price-asc':
        filteredProducts.sort((a, b) => a.currentPrice - b.currentPrice);
        break;
      case 'price-desc':
        filteredProducts.sort((a, b) => b.currentPrice - a.currentPrice);
        break;
      case 'discount':
        filteredProducts.sort((a, b) => {
          const discountA = ((a.originalPrice - a.currentPrice) / a.originalPrice) * 100;
          const discountB = ((b.originalPrice - b.currentPrice) / b.originalPrice) * 100;
          return discountB - discountA;
        });
        break;
      case 'recent':
        filteredProducts.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
        break;
    }
  }

  const result = paginate(filteredProducts, parseInt(page), parseInt(limit));
  res.json(result);
});

// GET /api/products/search - Search products
app.get('/api/products/search', (req, res) => {
  const { q, page = 1, limit = 12 } = req.query;

  if (!q) {
    return res.json({ data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 0 } });
  }

  const query = q.toLowerCase();
  const searchResults = products.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.id.toLowerCase().includes(query) ||
    p.category.toLowerCase().includes(query)
  );

  const result = paginate(searchResults, parseInt(page), parseInt(limit));
  res.json(result);
});

// GET /api/products/:id - Get single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});

// GET /api/products/:id/history - Get price history for product
app.get('/api/products/:id/history', (req, res) => {
  const { days } = req.query;
  const history = priceHistory[req.params.id];

  if (!history) {
    return res.status(404).json({ error: 'Price history not found' });
  }

  let filteredHistory = [...history];

  // Filter by days if specified
  if (days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    filteredHistory = filteredHistory.filter(h => new Date(h.date) >= cutoffDate);
  }

  res.json({
    productId: req.params.id,
    history: filteredHistory
  });
});

// GET /api/categories - List all categories
app.get('/api/categories', (req, res) => {
  res.json(categories);
});

// GET /api/categories/:slug - Get products by category
app.get('/api/categories/:slug(*)', (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const categorySlug = req.params.slug;

  const category = categories.find(c => c.slug === categorySlug);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const categoryProducts = products.filter(p => p.category === categorySlug);
  const result = paginate(categoryProducts, parseInt(page), parseInt(limit));

  res.json({
    category,
    ...result
  });
});

// POST /api/subscriptions - Create email subscription
app.post('/api/subscriptions', (req, res) => {
  const { email, productId, targetPrice, notificationType } = req.body;

  if (!email || !productId || !notificationType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if product exists
  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check for existing subscription
  const existingSubscription = subscriptions.find(
    s => s.email === email && s.productId === productId
  );

  if (existingSubscription) {
    return res.status(409).json({ error: 'Subscription already exists' });
  }

  const subscription = {
    id: `sub_${Date.now()}`,
    email,
    productId,
    targetPrice: targetPrice || null,
    notificationType,
    createdAt: new Date().toISOString()
  };

  subscriptions.push(subscription);

  res.status(201).json({
    message: 'Subscription created successfully',
    subscription
  });
});

// DELETE /api/subscriptions/:id - Remove subscription
app.delete('/api/subscriptions/:id', (req, res) => {
  const index = subscriptions.findIndex(s => s.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Subscription not found' });
  }

  subscriptions.splice(index, 1);
  res.json({ message: 'Subscription removed successfully' });
});

// GET /api/subscriptions - List subscriptions (for testing)
app.get('/api/subscriptions', (req, res) => {
  const { email } = req.query;

  if (email) {
    const userSubscriptions = subscriptions.filter(s => s.email === email);
    return res.json(userSubscriptions);
  }

  res.json(subscriptions);
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`);
  console.log('\nAvailable endpoints:');
  console.log('  GET  /api/stats');
  console.log('  GET  /api/products');
  console.log('  GET  /api/products/search?q=query');
  console.log('  GET  /api/products/:id');
  console.log('  GET  /api/products/:id/history');
  console.log('  GET  /api/categories');
  console.log('  GET  /api/categories/:slug');
  console.log('  POST /api/subscriptions');
  console.log('  DELETE /api/subscriptions/:id');
});
