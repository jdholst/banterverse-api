import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const withRateLimit = (handler, limit = 25) => {
  return async (req, res) => {
    const currentDate = new Date().toLocaleDateString();
    const key = `${req.url}:${currentDate}`;
  
    try {

      // Increment the request count using Redis
      const requestCount = await redis.incr(key);

      // Set the expiration time for the key if it's the first request of the day
      if (requestCount === 1) {
        await redis.expire(key, process.env.RATE_LIMIT_PERIOD ?? 86400);
      }

      console.log(`Request count: ${requestCount} for ${key}`);

      // Check if the request count has exceeded the limit
      if (requestCount > limit) {
        return res.status(429).json({ error: 'Request limit exceeded' });
      }
    } catch (error) {
      console.error(`Error interacting with Redis: ${error.message}`);
      return res.status(503).json({ error: 'Service Unavailable' });
    }

    return handler(req, res);
  };
};
