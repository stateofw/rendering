// index.js - Full WordPress proxy server for Railway
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
    
    // Fetch from WordPress
    const wpResponse = await fetch(wordpressUrl, {
      method: req.method,
      headers: {
        'Host': 'blog.elevatedfaith.com',
        'User-Agent': req.get('User-Agent') || 'Shopify-App-Proxy/1.0',
        'Accept': req.get('Accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.get('Accept-Language') || 'en-US,en;q=0.5',
        'X-Forwarded-For': req.get('X-Forwarded-For') || req.ip,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': req.get('Host') || 'elevatedfaith.com'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    
    const contentType = wpResponse.headers.get('content-type') || '';
    let content = await wpResponse.text();
    
    // Only process HTML content
    if (contentType.includes('text/html')) {
      console.log('Processing HTML content, length:', content.length);
      
      // Fix URLs in the content to point back to Shopify
      content = content
        // Fix absolute WordPress URLs
        .replace(/https?:\/\/blog\.elevatedfaith\.com/g, 'https://elevatedfaith.com/blog')
        // Fix relative URLs - add /blog prefix
        .replace(/href="\/(?!blog\/)([^"]*)"(?![^<]*<\/script>)/g, 'href="/blog/$1"')
        .replace(/src="\/(?!blog\/)([^"]*)"(?![^<]*<\/script>)/g, 'src="/blog/$1"')
        .replace(/action="\/(?!blog\/)([^"]*)"(?![^<]*<\/script>)/g, 'action="/blog/$1"')
        // Fix WordPress specific paths
        .replace(/\/wp-content\//g, '/blog/wp-content/')
        .replace(/\/wp-includes\//g, '/blog/wp-includes/')
        .replace(/\/wp-json\//g, '/blog/wp-json/')
        .replace(/\/wp-admin\//g, '/blog/wp-admin/')
        // Fix WordPress AJAX URL
        .replace(/ajaxurl\s*=\s*["'][^"']*\/wp-admin\/admin-ajax\.php["']/g, 'ajaxurl = "/blog/wp-admin/admin-ajax.php"')
        // Fix any remaining WordPress URLs in JavaScript
        .replace(/"https?:\/\/blog\.elevatedfaith\.com"/g, '"/blog"')
        .replace(/'https?:\/\/blog\.elevatedfaith\.com'/g, "'/blog'");
      
      console.log('URL rewriting completed');
    }
    
    // Set proper headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
      'X-Proxy-Cache': 'MISS',
      'X-Powered-By': 'Shopify-WordPress-Proxy'
    });
    
    // Handle redirects
    const location = wpResponse.headers.get('location');
    if (location) {
      const newLocation = location.replace(/https?:\/\/blog\.elevatedfaith\.com/, 'https://elevatedfaith.com/blog');
      res.set('Location', newLocation);
    }
    
    res.status(wpResponse.status).send(content);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({
      error: "Proxy failed",
      message: error.message,
      timestamp: new Date().toISOString()
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
