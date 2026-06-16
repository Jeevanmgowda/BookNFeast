const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { getDb } = require('./db');
const { buildSeedRecords, uid } = require('./seed-data');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_ADMIN = { username: 'admin', password: 'admin' };

const COLLECTIONS = [
  'rooms',
  'guests',
  'bookings',
  'menuItems',
  'tables',
  'orders',
  'staff',
  'activity'
];

/* ---------- Sort orders for each collection ---------- */
const SORT_ORDERS = {
  rooms: { number: 1 },
  guests: { name: 1 },
  bookings: { checkIn: -1, createdAt: -1 },
  menuItems: { category: 1, name: 1 },
  tables: { number: 1 },
  orders: { createdAt: -1 },
  staff: { name: 1 },
  activity: { time: -1, createdAt: -1 }
};

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve frontend and assets as static files
const projectRoot = path.join(__dirname, '..');
app.use(express.static(path.join(projectRoot, 'frontend')));
app.use('/assets', express.static(path.join(projectRoot, 'assets')));

/* ---------- Helpers ---------- */

function isValidCollection(col) {
  return COLLECTIONS.includes(col);
}

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
}

function stripMongoId(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return rest;
}

function stripMongoIds(docs) {
  return docs.map(stripMongoId);
}

/* ---------- Activity logging (replaces MySQL triggers) ---------- */

async function logActivity(db, icon, message, type = 'blue') {
  const record = {
    id: uid(),
    icon,
    message,
    type,
    time: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: null
  };
  await db.collection('activity').insertOne(record);
  return record;
}

/* ---------- Booking side-effects (replaces MySQL triggers) ---------- */

async function onBookingInsert(db, booking) {
  await logActivity(db, 'BK', `New booking: ${booking.guestName} - Room ${booking.roomNumber}`, 'green');
}

async function onBookingUpdate(db, oldBooking, newBooking) {
  if (newBooking.status !== oldBooking.status) {
    // Update room status
    if (newBooking.roomId && ['checked-in', 'checked-out', 'cancelled'].includes(newBooking.status)) {
      const roomStatus = newBooking.status === 'checked-in' ? 'occupied' : 'available';
      await db.collection('rooms').updateOne(
        { id: newBooking.roomId },
        { $set: { status: roomStatus, updatedAt: new Date().toISOString() } }
      );
    }

    // Log activity
    const actType = newBooking.status === 'cancelled' ? 'red'
      : newBooking.status === 'checked-out' ? 'gold' : 'blue';
    await logActivity(db, 'BK', `Booking ${newBooking.status}: ${newBooking.guestName} - Room ${newBooking.roomNumber}`, actType);
  }
}

async function onBookingDelete(db, booking) {
  if (booking.roomId && ['confirmed', 'checked-in'].includes(booking.status)) {
    await db.collection('rooms').updateOne(
      { id: booking.roomId },
      { $set: { status: 'available', updatedAt: new Date().toISOString() } }
    );
  }
  await logActivity(db, 'BK', `Booking deleted: ${booking.guestName} - Room ${booking.roomNumber}`, 'red');
}

/* ---------- Order side-effects (replaces MySQL triggers) ---------- */

async function onOrderInsert(db, order) {
  if (order.tableId && order.status === 'active') {
    await db.collection('tables').updateOne(
      { id: order.tableId },
      { $set: { status: 'occupied', updatedAt: new Date().toISOString() } }
    );
  }
  await logActivity(db, 'OD', `Order placed for Table ${order.tableNumber || 'N/A'}`, 'gold');
}

async function onOrderUpdate(db, oldOrder, newOrder) {
  if (newOrder.status !== oldOrder.status) {
    if (newOrder.tableId && ['active', 'completed', 'cancelled'].includes(newOrder.status)) {
      const tableStatus = newOrder.status === 'active' ? 'occupied' : 'available';
      await db.collection('tables').updateOne(
        { id: newOrder.tableId },
        { $set: { status: tableStatus, updatedAt: new Date().toISOString() } }
      );
    }

    const actType = newOrder.status === 'cancelled' ? 'red'
      : newOrder.status === 'completed' ? 'green' : 'gold';
    await logActivity(db, 'OD', `Order ${newOrder.status} for Table ${newOrder.tableNumber || 'N/A'}`, actType);
  }
}

async function onOrderDelete(db, order) {
  if (order.tableId && order.status === 'active') {
    await db.collection('tables').updateOne(
      { id: order.tableId },
      { $set: { status: 'available', updatedAt: new Date().toISOString() } }
    );
  }
  await logActivity(db, 'OD', `Order deleted for Table ${order.tableNumber || 'N/A'}`, 'red');
}

/* ---------- Admin bootstrap ---------- */

async function ensureAdminUser(db) {
  const count = await db.collection('admin_users').countDocuments();
  if (count > 0) return;

  const hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
  await db.collection('admin_users').insertOne({
    username: DEFAULT_ADMIN.username,
    password_hash: hash,
    created_at: new Date().toISOString(),
    updated_at: null
  });
}

/* ---------- Generic CRUD ---------- */

async function listCollection(db, collection) {
  const sort = SORT_ORDERS[collection] || {};
  const docs = await db.collection(collection).find({}).sort(sort).toArray();
  return stripMongoIds(docs);
}

async function getRecord(db, collection, id) {
  const doc = await db.collection(collection).findOne({ id });
  return stripMongoId(doc);
}

async function insertRecord(db, collection, input) {
  const now = new Date().toISOString();
  const record = {
    ...input,
    id: input.id || uid(),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || null
  };
  await db.collection(collection).insertOne(record);

  // Trigger side-effects
  if (collection === 'bookings') await onBookingInsert(db, record);
  if (collection === 'orders') await onOrderInsert(db, record);

  return stripMongoId(record);
}

async function updateRecord(db, collection, id, patch) {
  // Get old record for side-effect comparison
  const oldDoc = await db.collection(collection).findOne({ id });
  if (!oldDoc) return null;

  const updates = { ...patch, updatedAt: new Date().toISOString() };
  // Remove id and createdAt from patch to avoid overwriting them
  delete updates.id;
  delete updates.createdAt;

  await db.collection(collection).updateOne(
    { id },
    { $set: updates }
  );

  const newDoc = await db.collection(collection).findOne({ id });

  // Trigger side-effects
  if (collection === 'bookings') await onBookingUpdate(db, oldDoc, newDoc);
  if (collection === 'orders') await onOrderUpdate(db, oldDoc, newDoc);

  return stripMongoId(newDoc);
}

async function deleteRecord(db, collection, id) {
  const doc = await db.collection(collection).findOne({ id });
  if (!doc) return false;

  // Trigger side-effects before deletion
  if (collection === 'bookings') await onBookingDelete(db, doc);
  if (collection === 'orders') await onOrderDelete(db, doc);

  const result = await db.collection(collection).deleteOne({ id });
  return result.deletedCount > 0;
}

/* ---------- Routes ---------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/info', async (_req, res) => {
  try {
    const db = await getDb();
    const admin = await db.collection('admin_users').findOne({}, { projection: { username: 1 } });
    if (!admin) return res.json({ username: DEFAULT_ADMIN.username });
    res.json({ username: admin.username });
  } catch (err) {
    console.error('Auth info failed', err);
    res.status(500).json({ error: 'auth_info_failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });
  try {
    const db = await getDb();
    const admin = await db.collection('admin_users').findOne({ username });
    if (!admin) return res.status(401).json({ error: 'invalid_credentials' });
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return res.status(401).json({ error: 'invalid_credentials' });
    res.json({ ok: true, username: admin.username });
  } catch (err) {
    console.error('Login failed', err);
    res.status(500).json({ error: 'login_failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'missing_credentials' });
  }
  const cleanUsername = String(username).trim();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'username_too_short' });
  }
  try {
    const db = await getDb();
    const existing = await db.collection('admin_users').findOne({ username: cleanUsername });
    if (existing) {
      return res.status(400).json({ error: 'username_taken' });
    }
    const hash = await bcrypt.hash(password, 10);
    await db.collection('admin_users').insertOne({
      username: cleanUsername,
      password_hash: hash,
      created_at: new Date().toISOString(),
      updated_at: null
    });
    res.status(201).json({ ok: true, username: cleanUsername });
  } catch (err) {
    console.error('Signup failed', err);
    res.status(500).json({ error: 'signup_failed' });
  }
});

app.post('/api/auth/reset', async (req, res) => {
  const { username, currentPassword, newUsername, newPassword } = req.body || {};
  if (!username || !currentPassword || !newUsername || !newPassword) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    const db = await getDb();
    const user = await db.collection('admin_users').findOne({ username });
    if (!user) return res.status(404).json({ error: 'user_missing' });

    const ok = await bcrypt.compare(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    if (newUsername !== username) {
      const existing = await db.collection('admin_users').findOne({ username: newUsername });
      if (existing) return res.status(400).json({ error: 'username_taken' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.collection('admin_users').updateOne(
      { _id: user._id },
      { $set: { username: newUsername, password_hash: hash, updated_at: new Date().toISOString() } }
    );

    res.json({ ok: true, username: newUsername });
  } catch (err) {
    console.error('Reset failed', err);
    res.status(500).json({ error: 'reset_failed' });
  }
});

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const db = await getDb();
    const payload = {};
    for (const collection of COLLECTIONS) {
      payload[collection] = await listCollection(db, collection);
    }
    res.json(payload);
  } catch (err) {
    console.error('Bootstrap failed', err);
    res.status(500).json({ error: 'bootstrap_failed' });
  }
});

app.post('/api/seed', async (_req, res) => {
  try {
    const db = await getDb();
    const count = await db.collection('rooms').countDocuments();
    if (count > 0) return res.json({ seeded: false });

    const seedRecords = buildSeedRecords();
    for (const { collection, record } of seedRecords) {
      await insertRecord(db, collection, record);
    }

    res.json({ seeded: true, count: seedRecords.length });
  } catch (err) {
    console.error('Seed failed', err);
    res.status(500).json({ error: 'seed_failed' });
  }
});

app.get('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!isValidCollection(collection)) return res.status(400).json({ error: 'invalid_collection' });
  try {
    const db = await getDb();
    res.json(await listCollection(db, collection));
  } catch (err) {
    console.error('List failed', err);
    res.status(500).json({ error: 'list_failed' });
  }
});

app.get('/api/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!isValidCollection(collection)) return res.status(400).json({ error: 'invalid_collection' });
  try {
    const db = await getDb();
    const record = await getRecord(db, collection, id);
    if (!record) return res.status(404).json({ error: 'not_found' });
    res.json(record);
  } catch (err) {
    console.error('Get failed', err);
    res.status(500).json({ error: 'get_failed' });
  }
});

app.post('/api/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!isValidCollection(collection)) return res.status(400).json({ error: 'invalid_collection' });
  try {
    const db = await getDb();
    const record = await insertRecord(db, collection, req.body || {});
    res.status(201).json(record);
  } catch (err) {
    console.error('Create failed', err);
    res.status(500).json({ error: 'create_failed' });
  }
});

app.put('/api/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!isValidCollection(collection)) return res.status(400).json({ error: 'invalid_collection' });
  try {
    const db = await getDb();
    const record = await updateRecord(db, collection, id, req.body || {});
    if (!record) return res.status(404).json({ error: 'not_found' });
    res.json(record);
  } catch (err) {
    console.error('Update failed', err);
    res.status(500).json({ error: 'update_failed' });
  }
});

app.delete('/api/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!isValidCollection(collection)) return res.status(400).json({ error: 'invalid_collection' });
  try {
    const db = await getDb();
    await deleteRecord(db, collection, id);
    res.status(204).end();
  } catch (err) {
    console.error('Delete failed', err);
    res.status(500).json({ error: 'delete_failed' });
  }
});

/* ---------- Server startup ---------- */

async function startServer() {
  const db = await getDb();
  await ensureAdminUser(db);
  const server = app.listen(PORT, () => {
    console.log(`BookNFeast API running on http://localhost:${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use. Kill the other process or use a different port:\n   PORT=3001 npm run dev\n`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

// For Vercel: export the app as a serverless function
// For local dev: start the server with app.listen()
if (require.main === module) {
  startServer().catch(err => {
    if (err.name === 'MongoServerSelectionError' || err.name === 'MongoParseError') {
      console.error('\nMongoDB connection failed.');
      console.error(`Could not connect to: ${process.env.MONGODB_URI ? '(MONGODB_URI set)' : '(MONGODB_URI not set)'}`);
      console.error('Update backend/.env with a valid MONGODB_URI, then restart.\n');
    } else {
      console.error('Server failed to start', err);
    }
    process.exit(1);
  });
}

module.exports = app;
