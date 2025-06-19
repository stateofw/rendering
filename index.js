// index.js - Improved WordPress proxy server for Railway
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
    
    // For binary content (images, fonts, etc.), pass through as-is
    if (contentType.includes('image/') || 
        contentType.includes('font/') ||
        contentType.includes('application/octet-stream') ||
        blogPath.match(/\.(jpg|jpeg|png|gif|svg|ico|woff|woff2|ttf|eot|pdf)$/i)) {
      
      console.log('Passing through binary content:', contentType);
      
      // Copy headers for binary content
      wpResponse.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.set(key, value);
        }
      });
      
      // Stream binary content
      res.status(wpResponse.status);
      const buffer = await wpResponse.arrayBuffer();
      res.send(Buffer.from(buffer));
      return;
    }
    
    // For text content, get as text and process
    let content = await wpResponse.text();
    
    // Process HTML and CSS content
    if (contentType.includes('text/html') || contentType.includes('text/css')) {
      console.log('Processing text content, type:', contentType, 'length:', content.length);
      
      // Fix URLs in the content to point back to Shopify
      content = content
        // Fix absolute WordPress URLs
        .replace(/https?:\/\/blog\.elevatedfaith\.com/g, 'https://elevatedfaith.com/blog')
        
        // Fix relative URLs in href and src attributes
        .replace(/href="\/(?!blog\/)([^"]*)"(?![^<]*<\/script>)/g, 'href="/blog/$1"')
        .replace(/src="\/(?!blog\/)([^"]*)"(?![^<]*<\/script>)/g, 'src="/blog/$1"')
        .replace(/action="\/(?!blog\/)([^"]*)"(?![^<]*<\/script>)/g, 'action="/blog/$1"')
        
        // Fix WordPress specific paths
        .replace(/\/wp-content\//g, '/blog/wp-content/')
        .replace(/\/wp-includes\//g, '/blog/wp-includes/')
        .replace(/\/wp-json\//g, '/blog/wp-json/')
        .replace(/\/wp-admin\//g, '/blog/wp-admin/')
        
        // Fix CSS url() references
        .replace(/url\(["']?\/(?!blog\/)([^"']*?)["']?\)/g, 'url("/blog/$1")')
        
        // Fix CSS @import rules
        .replace(/@import\s+["']\/(?!blog\/)([^"']*?)["']/g, '@import "/blog/$1"')
        
        // Fix WordPress AJAX URL
        .replace(/ajaxurl\s*=\s*["'][^"']*\/wp-admin\/admin-ajax\.php["']/g, 'ajaxurl = "/blog/wp-admin/admin-ajax.php"')
        
        // Fix any remaining WordPress URLs in JavaScript
        .replace(/"https?:\/\/blog\.elevatedfaith\.com"/g, '"/blog"')
        .replace(/'https?:\/\/blog\.elevatedfaith\.com'/g, "'/blog'")
        
        // Fix WordPress REST API endpoints
        .replace(/wp-json\/wp\/v2\//g, 'blog/wp-json/wp/v2/');
      
      console.log('URL rewriting completed');
    }
    
    // Set proper headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': wpResponse.headers.get('cache-control') || 'public, max-age=300',
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
