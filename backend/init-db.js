const { getDb } = require('./db');

async function main() {
  const db = await getDb();

  console.log('Creating collections and indexes...');

  // admin_users
  await ensureCollection(db, 'admin_users');
  await db.collection('admin_users').createIndex({ username: 1 }, { unique: true });

  // rooms
  await ensureCollection(db, 'rooms');
  await db.collection('rooms').createIndex({ number: 1 }, { unique: true });
  await db.collection('rooms').createIndex({ status: 1 });
  await db.collection('rooms').createIndex({ type: 1 });

  // guests
  await ensureCollection(db, 'guests');
  await db.collection('guests').createIndex({ name: 1 });
  await db.collection('guests').createIndex({ phone: 1 });

  // bookings
  await ensureCollection(db, 'bookings');
  await db.collection('bookings').createIndex({ checkIn: 1, checkOut: 1 });
  await db.collection('bookings').createIndex({ status: 1 });
  await db.collection('bookings').createIndex({ guestId: 1 });
  await db.collection('bookings').createIndex({ roomId: 1 });

  // menuItems
  await ensureCollection(db, 'menuItems');
  await db.collection('menuItems').createIndex({ name: 1 }, { unique: true });
  await db.collection('menuItems').createIndex({ category: 1 });
  await db.collection('menuItems').createIndex({ available: 1 });

  // tables
  await ensureCollection(db, 'tables');
  await db.collection('tables').createIndex({ number: 1 }, { unique: true });
  await db.collection('tables').createIndex({ status: 1 });
  await db.collection('tables').createIndex({ section: 1 });

  // orders
  await ensureCollection(db, 'orders');
  await db.collection('orders').createIndex({ status: 1 });
  await db.collection('orders').createIndex({ tableId: 1 });
  await db.collection('orders').createIndex({ createdAt: -1 });

  // staff
  await ensureCollection(db, 'staff');
  await db.collection('staff').createIndex({ department: 1 });
  await db.collection('staff').createIndex({ role: 1 });
  await db.collection('staff').createIndex({ name: 1 });

  // activity
  await ensureCollection(db, 'activity');
  await db.collection('activity').createIndex({ time: -1 });
  await db.collection('activity').createIndex({ createdAt: -1 });

  console.log('BookNFeast MongoDB database initialized successfully.');
  process.exit(0);
}

async function ensureCollection(db, name) {
  const collections = await db.listCollections({ name }).toArray();
  if (collections.length === 0) {
    await db.createCollection(name);
    console.log(`  Created collection: ${name}`);
  } else {
    console.log(`  Collection exists: ${name}`);
  }
}

main().catch(err => {
  console.error('Database initialization failed:', err.message || err);
  process.exit(1);
});
