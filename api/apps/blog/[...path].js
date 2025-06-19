// api/apps/blog/[...path].js
// This catches all requests to /api/apps/blog/*

export default async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    console.log('Proxy request:', req.method, req.url);
    console.log('Query params:', req.query);
    
    // Extract the blog path from the dynamic route
    // req.query.path will be an array like ['some', 'post'] for /api/apps/blog/some/post
    const pathArray = req.query.path || [];
    const blogPath = pathArray.length > 0 ? `/${pathArray.join('/')}` : '/';
    
    // Build the WordPress URL
    const wordpressUrl = `https://blog.elevatedfaith.com${blogPath}`;
    console.log('Fetching from WordPress:', wordpressUrl);
    
    // Use fetch instead of axios (native in Node.js 18+)
    const wpResponse = await fetch(wordpressUrl, {
      method: req.method,
      headers: {
        'Host': 'blog.elevatedfaith.com',
        'User-Agent': req.headers['user-agent'] || 'Shopify-App-Proxy/1.0',
        'Accept': req.headers.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.5',
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': req.headers.host || 'elevatedfaith.com'
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    
    const contentType = wpResponse.headers.get('content-type') || '';
    let content = await wpResponse.text();
    
    // Only process HTML content
    if (contentType.includes('text/html')) {
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
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Proxy-Cache', 'MISS');
    res.setHeader('X-Powered-By', 'Shopify-WordPress-Proxy');
    
    // Handle redirects
    const location = wpResponse.headers.get('location');
    if (location) {
      const newLocation = location.replace('https://blog.elevatedfaith.com', 'https://elevatedfaith.com/blog');
      res.setHeader('Location', newLocation);
    }
    
    return res.status(wpResponse.status).send(content);
    
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
        <p><a href="https://blog.elevatedfaith.com${req.query.path ? `/${req.query.path.join('/')}` : ''}">Visit our blog directly</a></p>
        <hr>
        <small>Error: ${error.message}</small>
      </body>
      </html>
    `;
    
    return res.status(503).send(errorHtml);
  }
}
