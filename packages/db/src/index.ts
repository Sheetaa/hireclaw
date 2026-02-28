export * from './schema';

// Database connection - will be initialized at runtime
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString: databaseUrl,
    });
    
    db = drizzle(pool);
  }
  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
