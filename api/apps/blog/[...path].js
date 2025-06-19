// CommonJS export format for Vercel
module.exports = async (req, res) => {
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
    
    // Simple test first - just return success
    return res.status(200).json({
      message: "WordPress Proxy Function is Working!",
      path: req.query.path,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({
      error: "Function failed",
      message: error.message
    });
  }
};
