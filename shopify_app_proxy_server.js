// server.js - Deploy this to Vercel, Netlify, or Railway
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Shopify webhook verification
function verifyShopifyWebhook(data, hmacHeader) {
  const calculatedHmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(data, 'utf8')
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac, 'base64'),
    Buffer.from(hmacHeader, 'base64')
  );
}

// App Proxy endpoint - this is where the magic happens
app.all('/apps/blog*', async (req, res) => {
  try {
    console.log('Proxy request:', req.method, req.url);
    
    // Extract the blog path from the URL
    // /apps/blog/some-post -> /some-post
    const blogPath = req.url.replace('/apps/blog', '') || '/';
    
    // Build the WordPress URL
    const wordpressUrl = `https://blog.elevatedfaith.com${blogPath}`;
    console.log('Fetching from WordPress:', wordpressUrl);
    
    // Forward the request to WordPress
    const wpResponse = await axios({
      method: req.method,
      url: wordpressUrl,
      headers: {
        'Host': 'blog.elevatedfaith.com',
        'User-Agent': req.get('User-Agent') || 'Shopify-App-Proxy',
        'Accept': req.get('Accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.get('Accept-Language') || 'en-US,en;q=0.5',
        'X-Forwarded-For': req.get('X-Forwarded-For') || req.ip,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': req.get('Host')
      },
      data: req.body,
      timeout: 30000,
      maxRedirects: 5
    });
    
    let content = wpResponse.data;
    
    // Only process HTML content
    if (wpResponse.headers['content-type']?.includes('text/html')) {
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
    }
    
    // Set proper headers
    const responseHeaders = {
      'Content-Type': wpResponse.headers['content-type'] || 'text/html',
      'Cache-Control': 'public, max-age=300', // 5 minute cache
      'X-Proxy-Cache': 'MISS',
      'X-Powered-By': 'Shopify-WordPress-Proxy'
    };
    
    // Handle redirects
    if (wpResponse.headers.location) {
      responseHeaders['Location'] = wpResponse.headers.location
        .replace('https://blog.elevatedfaith.com', 'https://elevatedfaith.com/blog');
    }
    
    res.set(responseHeaders);
    res.status(wpResponse.status).send(content);
    
  } catch (error) {
    console.error('Proxy error:', error.message);
    
    // Return a user-friendly error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Blog Temporarily Unavailable</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #666; }
        </style>
      </head>
      <body>
        <h1>Blog Temporarily Unavailable</h1>
        <p class="error">We're experiencing technical difficulties. Please try again later.</p>
        <p><a href="https://blog.elevatedfaith.com">Visit our blog directly</a></p>
      </body>
      </html>
    `;
    
    res.status(503).send(errorHtml);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'shopify-wordpress-proxy'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Shopify WordPress Proxy Server',
    endpoints: ['/apps/blog/*', '/health']
  });
});

// Handle webhook verification (if needed)
app.post('/webhooks/app/uninstalled', (req, res) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  const body = JSON.stringify(req.body);
  
  if (verifyShopifyWebhook(body, hmacHeader)) {
    console.log('App uninstalled webhook received');
    // Handle app uninstallation if needed
  }
  
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Shopify WordPress Proxy running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Proxy endpoint: http://localhost:${PORT}/apps/blog/`);
});

module.exports = app;