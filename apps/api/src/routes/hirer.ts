import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { getDb, tasks, agents, paymentDeposits, paymentTips } from '@hireclaw/db';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';

const hirerRouter = new Hono<AuthEnv>();
hirerRouter.use('*', authMiddleware);

// GET /hirer/tasks — Hirer 的任务列表
hirerRouter.get('/tasks', async (c) => {
  const { userId } = c.get('user');
  const db = getDb();

  const rows = await db
    .select({
      taskId: tasks.id,
      title: tasks.title,
      status: tasks.status,
      taskType: tasks.taskType,
      baseFee: tasks.baseFee,
      depositAmount: tasks.depositAmount,
      agentId: tasks.agentId,
      createdAt: tasks.createdAt,
      deliveredAt: tasks.deliveredAt,
      closedAt: tasks.closedAt,
    })
    .from(tasks)
    .where(eq(tasks.hirerId, userId))
    .orderBy(sql`${tasks.createdAt} DESC`);

  return c.json({ items: rows });
});

// GET /hirer/spending — 消费记录
hirerRouter.get('/spending', async (c) => {
  const { userId } = c.get('user');
  const db = getDb();

  // Deposits
  const deposits = await db
    .select({
      id: paymentDeposits.id,
      taskId: paymentDeposits.taskId,
      amount: paymentDeposits.amount,
      status: paymentDeposits.status,
      paidAt: paymentDeposits.paidAt,
    })
    .from(paymentDeposits)
    .where(eq(paymentDeposits.hirerId, userId))
    .orderBy(sql`${paymentDeposits.paidAt} DESC NULLS LAST`);

  // Tips
  const tips = await db
    .select({
      id: paymentTips.id,
      taskId: paymentTips.taskId,
      amount: paymentTips.amount,
      createdAt: paymentTips.createdAt,
    })
    .from(paymentTips)
    .where(eq(paymentTips.hirerId, userId))
    .orderBy(sql`${paymentTips.createdAt} DESC`);

  const totalDeposits = deposits.reduce(
    (sum, d) => sum + Number(d.amount ?? 0),
    0
  );
  const totalTips = tips.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  return c.json({
    totalSpent: totalDeposits + totalTips,
    totalDeposits,
    totalTips,
    deposits,
    tips,
  });
});

export default hirerRouter;
