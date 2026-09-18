/**
 * 404 Not Found Middleware
 * Triggered when no previous routes match the incoming request
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl} - Route Not Found`
  });
};
