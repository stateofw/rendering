// api/blog.js - Simple single endpoint
export default async function handler(req, res) {
  try {
    // Get the path from query parameter
    const blogPath = req.query.path || '/';
    
    // Simple test first
    return res.status(200).json({
      message: "Blog proxy is working!",
      requestedPath: blogPath,
      wordpressUrl: `https://blog.elevatedfaith.com${blogPath}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return res.status(500).json({
      error: "Function error",
      message: error.message
    });
  }
}
