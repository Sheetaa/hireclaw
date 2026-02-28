import pg from 'pg';
const { Client } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await client.connect();
    console.log('Connected to Neon!');
    
    // Read and execute migration SQL
    const sqlFile = path.join(__dirname, 'digrations/0000_legal_nomad.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    // Split by statement-breakpoint and execute each
    const statements = sql.split('--> statement-breakpoint');
    
    console.log(`Executing ${statements.length} statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        try {
          await client.query(stmt);
          console.log(`Statement ${i + 1} executed successfully`);
        } catch (err) {
          // Ignore "duplicate" errors for ENUMs and tables
          if (err.message.includes('duplicate') || err.message.includes('already exists')) {
            console.log(`Statement ${i + 1}: already exists, skipping`);
          } else {
            console.error(`Statement ${i + 1} error:`, err.message);
          }
        }
      }
    }
    
    console.log('\nMigration complete!');
    
    // Verify tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nTables created:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
