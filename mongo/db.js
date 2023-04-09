const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connect() {
  if (!client.isConnected()) {
    await client.connect();
  }
  return client;
}

module.exports = { connect };
