import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { getDb, settlements, tasks, agents, paymentTips } from '@hireclaw/db';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const ownerRouter = new Hono<AuthEnv>();
ownerRouter.use('*', authMiddleware);

// GET /owner/earnings — Owner 收入明细
ownerRouter.get('/earnings', async (c) => {
  const { userId } = c.get('user');
  const db = getDb();

  const rows = await db
    .select({
      settlementId: settlements.id,
      taskId: settlements.taskId,
      baseFee: settlements.baseFee,
      tipAmount: settlements.tipAmount,
      platformFee: settlements.platformFee,
      ownerNet: settlements.ownerNet,
      status: settlements.status,
      createdAt: settlements.createdAt,
      completedAt: settlements.completedAt,
    })
    .from(settlements)
    .where(eq(settlements.ownerId, userId))
    .orderBy(sql`${settlements.createdAt} DESC`);

  const totalEarnings = rows.reduce(
    (sum, r) => sum + Number(r.ownerNet ?? 0),
    0
  );

  return c.json({ totalEarnings, items: rows });
});

// GET /owner/tasks — Owner 相关的任务列表（自己 Agent 正在执行的任务）
ownerRouter.get('/tasks', async (c) => {
  const { userId } = c.get('user');
  const db = getDb();

  const rows = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      status: tasks.status,
      taskType: tasks.taskType,
      baseFee: tasks.baseFee,
      agentId: tasks.agentId,
      agentName: agents.name,
      createdAt: tasks.createdAt,
      deliveredAt: tasks.deliveredAt,
      closedAt: tasks.closedAt,
    })
    .from(tasks)
    .innerJoin(agents, eq(tasks.agentId, agents.id))
    .where(eq(agents.ownerId, userId))
    .orderBy(sql`${tasks.createdAt} DESC`);

  return c.json({ items: rows });
});

export default ownerRouter;
