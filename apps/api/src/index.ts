import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth.js';
import profile from './routes/profile.js';
import agentsRoute from './routes/agents.js';
import tasksRouter from './routes/tasks.js';
import settlementsRouter from './routes/settlements.js';
import ownerRouter from './routes/owner.js';
import hirerRouter from './routes/hirer.js';
import dashboardRouter from './routes/dashboard.js';

const app = new Hono();

// CORS - allow web frontends
app.use('*', cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3099').split(','),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.get('/', (c) => c.text('HireClaw API'));

// Mount routes
app.route('/auth', auth);
app.route('/profile', profile);
app.route('/agents', agentsRoute);
app.route('/tasks', tasksRouter);
app.route('/owner/settlements', settlementsRouter);
app.route('/owner', ownerRouter);
app.route('/hirer', hirerRouter);
app.route('/dashboard', dashboardRouter);

const port = Number(process.env.PORT) || 3000;
console.log(`Server is running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });

export default app;
