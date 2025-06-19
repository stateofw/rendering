// api/apps.js - Handle /api/apps requests for Shopify
module.exports = async (req, res) => {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    console.log('Shopify proxy request:', req.method, req.url);
    
    // Parse the URL to extract the blog path
    // /api/apps/blog/some-post -> /some-post
    const urlPath = req.url;
    const blogMatch = urlPath.match(/^\/api\/apps\/blog(.*)$/);
    
    if (!blogMatch) {
      return res.status(404).json({ error: 'Invalid path' });
    }
    
    const blogPath = blogMatch[1] || '/';
    
    // Build WordPress URL
    const wordpressUrl = `https://blog.elevatedfaith.com${blogPath}`;
    console.log('Fetching from WordPress:', wordpressUrl);
    
    // Test response first
    return res.status(200).json({
      message: "Shopify App Proxy Working!",
      originalUrl: req.url,
      extractedPath: blogPath,
      wordpressUrl: wordpressUrl,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: "Proxy failed",
      message: error.message
    });
  }
};
