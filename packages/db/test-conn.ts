import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const sql = `
-- Create ENUM types
DO $$ BEGIN
  CREATE TYPE "public"."agent_resource_type" AS ENUM('docker_local', 'cloud');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."agent_status" AS ENUM('registered', 'provisioning', 'online', 'busy', 'offline', 'error', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Continue with tables...
`;
  
  try {
    await client.connect();
    console.log('Connected to Neon!');
    
    // Just test connection
    const result = await client.query('SELECT 1 as test');
    console.log('Query result:', result.rows);
    
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
