const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/booknfeast';

let cached = { client: null, db: null };

async function getDb() {
  if (cached.db) return cached.db;

  const client = await MongoClient.connect(MONGODB_URI);
  const dbName = new URL(MONGODB_URI).pathname.slice(1) || 'booknfeast';
  cached = { client, db: client.db(dbName) };
  return cached.db;
}

module.exports = { getDb };
