const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    await connection.query(schema);

    const constraintsPath = path.join(__dirname, '..', 'database', 'triggers.sql');
    const constraints = await fs.readFile(constraintsPath, 'utf8');
    await runConstraintFile(connection, constraints);

    console.log('BookNFeast database schema and constraints initialized.');
  } finally {
    await connection.end();
  }
}

async function runConstraintFile(connection, sql) {
  const statements = sql
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      await connection.query(statement);
    } catch (err) {
      if (isDuplicateConstraintError(err)) {
        continue;
      }

      throw err;
    }
  }
}

function isDuplicateConstraintError(err) {
  return err.code === 'ER_CHECK_CONSTRAINT_DUP_NAME'
    || err.code === 'ER_DUP_KEYNAME'
    || err.errno === 3822
    || err.errno === 1061;
}

main().catch(err => {
  console.error('Database initialization failed:', err.code || err.name || 'ERROR', err.message || '');
  process.exit(1);
});
