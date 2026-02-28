import { Hono } from 'hono';
import { eq, sql, and, gte, count } from 'drizzle-orm';
import { getDb, tasks, paymentTips, feedback } from '@hireclaw/db';
import { TaskStatus, FeedbackType } from '@hireclaw/shared/enums';

const dashboardRouter = new Hono();

// GET /dashboard/metrics — 全局看板指标
dashboardRouter.get('/metrics', async (c) => {
  const db = getDb();

  // 1. 打赏率 & 平均打赏额
  const [closedStats] = await db
    .select({
      totalClosed: count(),
    })
    .from(tasks)
    .where(eq(tasks.status, TaskStatus.Closed));

  const [tipStats] = await db
    .select({
      tippedTasks: sql<number>`count(distinct ${paymentTips.taskId})`.as('tipped_tasks'),
      totalTipAmount: sql<number>`coalesce(sum(${paymentTips.amount}), 0)`.as('total_tip_amount'),
    })
    .from(paymentTips)
    .innerJoin(tasks, and(eq(paymentTips.taskId, tasks.id), eq(tasks.status, TaskStatus.Closed)));

  const totalClosed = Number(closedStats?.totalClosed ?? 0);
  const tippedTasks = Number(tipStats?.tippedTasks ?? 0);
  const totalTipAmount = Number(tipStats?.totalTipAmount ?? 0);

  const tipRate = totalClosed > 0 ? tippedTasks / totalClosed : 0;
  const avgTipAmount = tippedTasks > 0 ? totalTipAmount / tippedTasks : 0;

  // 2. 回访率（30天）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Active hirers in last 30 days (created at least one task)
  const [activeHirers] = await db
    .select({
      count: sql<number>`count(distinct ${tasks.hirerId})`.as('count'),
    })
    .from(tasks)
    .where(gte(tasks.createdAt, thirtyDaysAgo));

  // Repeat hirers: hirers with >1 task in last 30 days
  const repeatHirersResult = await db
    .select({
      hirerId: tasks.hirerId,
      taskCount: sql<number>`count(*)`.as('task_count'),
    })
    .from(tasks)
    .where(gte(tasks.createdAt, thirtyDaysAgo))
    .groupBy(tasks.hirerId)
    .having(sql`count(*) > 1`);

  const activeHirerCount = Number(activeHirers?.count ?? 0);
  const repeatHirerCount = repeatHirersResult.length;
  const returnRate = activeHirerCount > 0 ? repeatHirerCount / activeHirerCount : 0;

  // 3. 满意度
  const [feedbackStats] = await db
    .select({
      totalFeedback: count(),
      satisfiedOrPartial: sql<number>`count(*) filter (where ${feedback.type} in (${sql.raw(`'${FeedbackType.Satisfied}', '${FeedbackType.Partial}'`)}))`.as('satisfied_or_partial'),
    })
    .from(feedback);

  const totalFeedback = Number(feedbackStats?.totalFeedback ?? 0);
  const satisfiedOrPartial = Number(feedbackStats?.satisfiedOrPartial ?? 0);
  const satisfactionRate = totalFeedback > 0 ? satisfiedOrPartial / totalFeedback : 0;

  return c.json({
    tipRate: Math.round(tipRate * 10000) / 10000,
    avgTipAmount: Math.round(avgTipAmount * 100) / 100,
    returnRate30d: Math.round(returnRate * 10000) / 10000,
    satisfactionRate: Math.round(satisfactionRate * 10000) / 10000,
    _raw: {
      totalClosed,
      tippedTasks,
      totalTipAmount,
      activeHirerCount,
      repeatHirerCount,
      totalFeedback,
      satisfiedOrPartial,
    },
  });
});

export default dashboardRouter;
