const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDatabase() {
  console.log('🔄 Connecting to MySQL server to initialize database...');

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true,
  });

  const sqlFiles = [
    '../database/schema.sql',
    '../database/triggers.sql',
    '../database/procedures.sql',
    '../database/views.sql',
    '../database/indexes.sql',
    '../database/seeds/exercises.sql',
    '../database/seeds/foods.sql',
  ];

  try {
    for (const relPath of sqlFiles) {
      const fullPath = path.join(__dirname, relPath);
      if (fs.existsSync(fullPath)) {
        console.log(`📄 Executing ${relPath}...`);
        const sql = fs.readFileSync(fullPath, 'utf-8');
        await connection.query(sql);
        console.log(`✅ Completed ${relPath}`);
      }
    }
    console.log('✨ All database tables, triggers, procedures, views, and seeds initialized successfully!');
  } catch (err) {
    console.error('❌ Error executing SQL script:', err);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
