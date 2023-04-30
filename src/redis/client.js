import { createClient } from 'redis';

const client = createClient(process.env.REDIS_URL);

client.on('error', (err) => {
  console.error('Redis error:', err);
});

async function connectToClient() {
  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export default connectToClient;
