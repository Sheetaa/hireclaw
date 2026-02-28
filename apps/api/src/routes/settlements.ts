import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { getDb, settlements, tasks, agents } from '@hireclaw/db';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const settlementsRouter = new Hono<AuthEnv>();

settlementsRouter.use('*', authMiddleware);

// GET /owner/settlements - Owner views their settlement records
settlementsRouter.get('/', async (c) => {
  const { userId } = c.get('user');
  const db = getDb();

  // Find all settlements where the owner is the current user
  // ownerId may be set on the settlement, or we need to look it up via task → agent → owner
  const result = await db
    .select({
      id: settlements.id,
      taskId: settlements.taskId,
      ownerId: settlements.ownerId,
      depositId: settlements.depositId,
      baseFee: settlements.baseFee,
      tipAmount: settlements.tipAmount,
      platformFee: settlements.platformFee,
      ownerNet: settlements.ownerNet,
      status: settlements.status,
      createdAt: settlements.createdAt,
      baseFeePaidAt: settlements.baseFeePaidAt,
      completedAt: settlements.completedAt,
    })
    .from(settlements)
    .innerJoin(tasks, eq(tasks.id, settlements.taskId))
    .innerJoin(agents, eq(agents.id, tasks.agentId))
    .where(eq(agents.ownerId, userId))
    .orderBy(sql`${settlements.createdAt} DESC`);

  return c.json({ data: result });
});

export default settlementsRouter;
