import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './digrations',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/hireclaw',
  },
  verbose: true,
  strict: true,
});
