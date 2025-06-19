// index.js - Main server file for Railway
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Shopify WordPress Proxy Server',
    status: 'healthy',
    endpoints: ['/api/apps/blog/*']
  });
});

// Blog proxy endpoint - handles /api/apps/blog/*
app.all('/api/apps/blog*', async (req, res) => {
  try {
    console.log('Shopify proxy request:', req.method, req.url);
    
    // Extract blog path from URL
    // /api/apps/blog/some-post -> /some-post
    const blogPath = req.url.replace('/api/apps/blog', '') || '/';
    
    // Build WordPress URL
    const wordpressUrl = `https://blog.elevatedfaith.com${blogPath}`;
    console.log('Fetching from WordPress:', wordpressUrl);
    
    // For now, return test response
    res.json({
      message: "Railway Shopify Proxy Working!",
      originalUrl: req.url,
      extractedPath: blogPath,
      wordpressUrl: wordpressUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: "Proxy failed",
      message: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.originalUrl 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/api/apps/blog`);
});

module.exports = app;
