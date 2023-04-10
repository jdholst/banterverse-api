/**
 * Rate limiter middleware for limiting requests to specified URLs.
 *
 * @function rateLimiter
 * @param {Object} config - An dictionary containing URL pattern keys and their corresponding rate limits.
 * @returns {Function} Middleware function for Express.
 *
 * @example
 * // Middleware configuration
 * const rateLimiterConfig = {
 *   '/example/v1/examples/create': 5,
 *   '/example/v1/examples/[0-9a-fA-F\-]+/edit': 12,
 * };
 * // Apply the rate limiter middleware
 * app.use(rateLimiter(rateLimiterConfig));
 */
const rateLimiter = (config) => {
  const requestCounts = new Map();

  return (req, res, next) => {
    const currentDate = new Date().toLocaleDateString();

    for (const [url, limit] of Object.entries(config)) {
      if (req.path.match(url)) {
        // Initialize the request count for the URL and date if it doesn't exist
        const key = `${req.path}:${currentDate}`;
        if (!requestCounts.has(key)) {
          requestCounts.set(key, 0);
        }

        // Increment the request count
        requestCounts.set(key, requestCounts.get(key) + 1);

        console.log(`Request count: ${requestCounts.get(key)} for ${key}`);
        // Check if the request count has exceeded the limit
        if (requestCounts.get(key) > limit) {
          return res.status(429).json({ error: 'Request limit exceeded' });
        }

        // Move on to the next middleware or route handler if the request count is within the limit
        break;
      }
    }

    next();
  };
};

module.exports = rateLimiter;
