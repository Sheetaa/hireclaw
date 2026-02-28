import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, tasks, agents, paymentDeposits, settlements, feedback, ownerProfiles, paymentTips } from '@hireclaw/db';
import { TaskStatus, PaymentDepositStatus, SettlementStatus, ComplexityLevel, RefundReason, FeedbackType } from '@hireclaw/shared/enums';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/audit.js';
import { createTaskSchema, listTasksSchema, assignAgentSchema } from '../validators/task.js';

const tasksRouter = new Hono<AuthEnv>();

tasksRouter.use('*', authMiddleware);

// Cancellable states
const CANCELLABLE_STATUSES: string[] = [
  TaskStatus.Draft,
  TaskStatus.AgentAssigned,
  TaskStatus.DepositPaid,
  TaskStatus.Running,
  TaskStatus.Blocked,
];

// POST /tasks - create task (draft)
tasksRouter.post('/', async (c) => {
  const { userId } = c.get('user');
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const db = getDb();
  const [task] = await db.insert(tasks).values({
    hirerId: userId,
    title: parsed.data.title,
    description: parsed.data.description,
    taskType: parsed.data.taskType as any,
    complexityLevel: parsed.data.complexityLevel as any ?? null,
    baseFee: parsed.data.baseFee ?? null,
    depositAmount: parsed.data.depositAmount ?? null,
    status: TaskStatus.Draft,
  }).returning();

  return c.json(task, 201);
});

// GET /tasks - list tasks
tasksRouter.get('/', async (c) => {
  const { userId, role: userRoles } = c.get('user');
  const query = listTasksSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: 'Validation failed', details: query.error.flatten() }, 400);
  }

  const { role, status, limit, offset } = query.data;
  const db = getDb();

  const conditions: any[] = [];

  // Role-based filtering
  if (role === 'agent_owner') {
    // Show tasks where user's agents are assigned
    conditions.push(sql`${tasks.agentId} IN (SELECT id FROM agents WHERE owner_id = ${userId})`);
  } else {
    // Default: show hirer's own tasks
    conditions.push(eq(tasks.hirerId, userId));
  }

  if (status) {
    conditions.push(eq(tasks.status, status as any));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const result = await db.select().from(tasks).where(where)
    .orderBy(sql`${tasks.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return c.json({ data: result, limit, offset });
});

// GET /tasks/:id - task detail
tasksRouter.get('/:id', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json(task);
});

// POST /tasks/:id/assign-agent - draft -> agent_assigned
tasksRouter.post('/:id/assign-agent', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const body = await c.req.json();
  const parsed = assignAgentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }
  if (task.hirerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (task.status !== TaskStatus.Draft) {
    return c.json({ error: `Cannot assign agent: task status is '${task.status}', expected 'draft'` }, 400);
  }

  // Verify agent exists
  const [agent] = await db.select().from(agents).where(eq(agents.id, parsed.data.agentId)).limit(1);
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const [updated] = await db.update(tasks).set({
    agentId: parsed.data.agentId,
    status: TaskStatus.AgentAssigned,
    agentAssignedAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  // Audit log (fire-and-forget)
  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'assign_agent',
    actorId: userId,
    actorRole: 'hirer',
    stateBefore: TaskStatus.Draft,
    stateAfter: TaskStatus.AgentAssigned,
    metadata: { agentId: parsed.data.agentId },
  });

  return c.json(updated);
});

// POST /tasks/:id/cancel
tasksRouter.post('/:id/cancel', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }
  if (task.hirerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  if (!CANCELLABLE_STATUSES.includes(task.status)) {
    return c.json({ error: `Cannot cancel task in status '${task.status}'` }, 400);
  }

  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Cancelled,
    closedAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  // Audit log (fire-and-forget)
  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'cancel',
    actorId: userId,
    actorRole: 'hirer',
    stateBefore: task.status,
    stateAfter: TaskStatus.Cancelled,
  });

  return c.json(updated);
});

// POST /tasks/:id/deliver - agent owner delivers task (running -> delivered)
tasksRouter.post('/:id/deliver', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.status !== TaskStatus.Running) {
    return c.json({ error: `Cannot deliver: task status is '${task.status}', expected 'running'` }, 400);
  }
  if (!task.agentId) {
    return c.json({ error: 'No agent assigned to this task' }, 400);
  }

  // Verify caller is the agent's owner
  const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  if (agent.ownerId !== userId) {
    return c.json({ error: 'Forbidden: only the agent owner can deliver' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const deliverables = body.deliverables ?? null;

  // Update task status to delivered
  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Delivered,
    deliveredAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  // Decrease agent current_load
  await db.update(agents).set({
    currentLoad: sql`GREATEST(${agents.currentLoad} - 1, 0)`,
  }).where(eq(agents.id, task.agentId));

  // Audit log
  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'deliver',
    actorId: userId,
    actorRole: 'agent_owner',
    stateBefore: TaskStatus.Running,
    stateAfter: TaskStatus.Delivered,
    metadata: { agentId: task.agentId, deliverables },
  });

  return c.json(updated);
});

// === ACCEPT / REJECT ===

// POST /tasks/:id/accept - agent owner accepts task
tasksRouter.post('/:id/accept', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (!task.agentId) return c.json({ error: 'No agent assigned' }, 400);

  // Verify caller is agent owner
  const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
  if (!agent || agent.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (task.status !== TaskStatus.DepositPaid) {
    return c.json({ error: `Cannot accept: task status is '${task.status}', expected 'deposit_paid'` }, 400);
  }

  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Running,
    acceptedAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  // Increment agent current_load
  await db.update(agents).set({
    currentLoad: sql`${agents.currentLoad} + 1`,
  }).where(eq(agents.id, task.agentId));

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'accept',
    actorId: userId,
    actorRole: 'agent_owner',
    stateBefore: TaskStatus.DepositPaid,
    stateAfter: TaskStatus.Running,
    metadata: { agentId: task.agentId },
  });

  return c.json(updated);
});

// POST /tasks/:id/reject - agent owner rejects task
tasksRouter.post('/:id/reject', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (!task.agentId) return c.json({ error: 'No agent assigned' }, 400);

  // Verify caller is agent owner
  const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
  if (!agent || agent.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (task.status !== TaskStatus.AgentAssigned) {
    return c.json({ error: `Cannot reject: task status is '${task.status}', expected 'agent_assigned'` }, 400);
  }

  // Update task → rejected
  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Rejected,
    closedAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  // Refund deposit if exists
  const [deposit] = await db.select().from(paymentDeposits)
    .where(and(eq(paymentDeposits.taskId, taskId), eq(paymentDeposits.status, PaymentDepositStatus.Paid)))
    .limit(1);

  if (deposit) {
    await db.update(paymentDeposits).set({
      status: PaymentDepositStatus.Refunded,
      refundReason: RefundReason.TaskRejected,
      refundedAt: new Date(),
    }).where(eq(paymentDeposits.id, deposit.id));

    await db.update(settlements).set({
      status: SettlementStatus.Reversed,
    }).where(eq(settlements.depositId, deposit.id));
  }

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'reject',
    actorId: userId,
    actorRole: 'agent_owner',
    stateBefore: TaskStatus.AgentAssigned,
    stateAfter: TaskStatus.Rejected,
    metadata: { agentId: task.agentId },
  });

  return c.json(updated);
});

// === BLOCKED / RESUME ===

// POST /tasks/:id/block - mark running task as blocked (e.g. agent error)
tasksRouter.post('/:id/block', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (!task.agentId) return c.json({ error: 'No agent assigned' }, 400);

  // Only hirer or agent owner can block
  const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  if (task.hirerId !== userId && agent.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (task.status !== TaskStatus.Running) {
    return c.json({ error: `Cannot block: task status is '${task.status}', expected 'running'` }, 400);
  }

  const now = new Date();
  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Blocked,
    blockedAt: now,
  }).where(eq(tasks.id, taskId)).returning();

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'block',
    actorId: userId,
    actorRole: task.hirerId === userId ? 'hirer' : 'agent_owner',
    stateBefore: TaskStatus.Running,
    stateAfter: TaskStatus.Blocked,
    metadata: { agentId: task.agentId },
  });

  return c.json(updated);
});

// POST /tasks/:id/resume - resume blocked task
tasksRouter.post('/:id/resume', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (!task.agentId) return c.json({ error: 'No agent assigned' }, 400);

  // Only hirer or agent owner can resume
  const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
  if (!agent) return c.json({ error: 'Agent not found' }, 404);
  if (task.hirerId !== userId && agent.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (task.status !== TaskStatus.Blocked) {
    return c.json({ error: `Cannot resume: task status is '${task.status}', expected 'blocked'` }, 400);
  }

  // 2-hour recovery window check
  if (task.blockedAt) {
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (Date.now() - new Date(task.blockedAt).getTime() > twoHoursMs) {
      return c.json({ error: 'Recovery window expired: task was blocked more than 2 hours ago' }, 400);
    }
  }

  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Running,
  }).where(eq(tasks.id, taskId)).returning();

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'resume',
    actorId: userId,
    actorRole: task.hirerId === userId ? 'hirer' : 'agent_owner',
    stateBefore: TaskStatus.Blocked,
    stateAfter: TaskStatus.Running,
    metadata: { agentId: task.agentId },
  });

  return c.json(updated);
});

// === DEPOSIT FLOW ===

// Estimate deposit from complexity level
function estimateDeposit(complexity: string | null): string {
  const map: Record<string, string> = {
    [ComplexityLevel.L1]: '50.00',
    [ComplexityLevel.L2]: '100.00',
    [ComplexityLevel.L3]: '200.00',
    [ComplexityLevel.L4]: '500.00',
  };
  return complexity ? map[complexity] ?? '100.00' : '100.00';
}

// POST /tasks/:id/deposit - pay deposit
tasksRouter.post('/:id/deposit', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (task.status !== TaskStatus.AgentAssigned) {
    return c.json({ error: `Cannot pay deposit: task status is '${task.status}', expected 'agent_assigned'` }, 400);
  }

  const amount = task.depositAmount ?? estimateDeposit(task.complexityLevel);

  // Create payment_deposit record
  const [deposit] = await db.insert(paymentDeposits).values({
    taskId,
    hirerId: userId,
    amount,
    status: PaymentDepositStatus.Paid,
    paidAt: new Date(),
  }).returning();

  // Create settlement record
  const [settlement] = await db.insert(settlements).values({
    taskId,
    ownerId: null,
    depositId: deposit.id,
    baseFee: task.baseFee,
    status: SettlementStatus.Pending,
  }).returning();

  // Update task status
  const [updated] = await db.update(tasks).set({
    status: TaskStatus.DepositPaid,
    depositAmount: amount,
    depositPaidAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  return c.json({ task: updated, deposit, settlement }, 201);
});

// GET /tasks/:id/deposit - get deposit status
tasksRouter.get('/:id/deposit', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);

  const depositRecords = await db.select().from(paymentDeposits)
    .where(eq(paymentDeposits.taskId, taskId));

  return c.json({ taskId, deposits: depositRecords });
});

// POST /tasks/:id/refund - refund deposit
tasksRouter.post('/:id/refund', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);

  // Find paid deposit
  const [deposit] = await db.select().from(paymentDeposits)
    .where(and(eq(paymentDeposits.taskId, taskId), eq(paymentDeposits.status, PaymentDepositStatus.Paid)))
    .limit(1);

  if (!deposit) return c.json({ error: 'No paid deposit found for this task' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const refundReason = body.refundReason ?? 'hirer_cancelled';

  // Update deposit
  const [updatedDeposit] = await db.update(paymentDeposits).set({
    status: PaymentDepositStatus.Refunded,
    refundReason: refundReason as any,
    refundedAt: new Date(),
  }).where(eq(paymentDeposits.id, deposit.id)).returning();

  // Update settlement
  await db.update(settlements).set({
    status: SettlementStatus.Reversed,
  }).where(eq(settlements.depositId, deposit.id));

  // Update task
  const [updatedTask] = await db.update(tasks).set({
    status: TaskStatus.Refunded,
  }).where(eq(tasks.id, taskId)).returning();

  return c.json({ task: updatedTask, deposit: updatedDeposit });
});

// === BASE FEE ===

// Base fee calculation from complexity level
const BASE_FEE_MAP: Record<string, string> = {
  [ComplexityLevel.L1]: '150.00',  // 100 × 1.5
  [ComplexityLevel.L2]: '300.00',  // 200 × 1.5
  [ComplexityLevel.L3]: '600.00',  // 400 × 1.5
  [ComplexityLevel.L4]: '1200.00', // 800 × 1.5
};

function calculateBaseFee(complexity: string | null): string {
  return complexity ? BASE_FEE_MAP[complexity] ?? '150.00' : '150.00';
}

// GET /tasks/:id/base-fee - query base fee amount
tasksRouter.get('/:id/base-fee', async (c) => {
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);

  const baseFee = task.baseFee ?? calculateBaseFee(task.complexityLevel);

  return c.json({ taskId, baseFee, complexityLevel: task.complexityLevel });
});

// POST /tasks/:id/pay-base-fee - hirer pays base fee (delivered → base_fee_paid)
tasksRouter.post('/:id/pay-base-fee', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (task.status !== TaskStatus.Delivered) {
    return c.json({ error: `Cannot pay base fee: task status is '${task.status}', expected 'delivered'` }, 400);
  }

  const baseFee = task.baseFee ?? calculateBaseFee(task.complexityLevel);

  // Update settlement
  await db.update(settlements).set({
    baseFee,
    status: SettlementStatus.BaseFeePaid,
    baseFeePaidAt: new Date(),
  }).where(eq(settlements.taskId, taskId));

  // Update task
  const [updated] = await db.update(tasks).set({
    status: TaskStatus.BaseFeePaid,
    baseFee,
    baseFeePaidAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'pay_base_fee',
    actorId: userId,
    actorRole: 'hirer',
    stateBefore: TaskStatus.Delivered,
    stateAfter: TaskStatus.BaseFeePaid,
    metadata: { baseFee },
  });

  return c.json(updated);
});

// === FEEDBACK ===

// POST /tasks/:id/feedback - hirer submits feedback (base_fee_paid → satisfied/partial/unsatisfied)
tasksRouter.post('/:id/feedback', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const body = await c.req.json();

  const feedbackType = body.type as string;
  if (!feedbackType || ![FeedbackType.Satisfied, FeedbackType.Partial, FeedbackType.Unsatisfied].includes(feedbackType as FeedbackType)) {
    return c.json({ error: 'Invalid feedback type. Must be: satisfied, partial, unsatisfied' }, 400);
  }

  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (task.status !== TaskStatus.BaseFeePaid) {
    return c.json({ error: `Cannot submit feedback: task status is '${task.status}', expected 'base_fee_paid'` }, 400);
  }

  // Insert feedback record
  const [fb] = await db.insert(feedback).values({
    taskId,
    type: feedbackType as FeedbackType,
    reasonCategory: body.reasonCategory ?? null,
    reasonText: body.reasonText ?? null,
  }).returning();

  // Determine new task status and handle side effects
  let newStatus: string;
  const now = new Date();

  if (feedbackType === FeedbackType.Satisfied || feedbackType === FeedbackType.Partial) {
    newStatus = TaskStatus.Closed;

    // Update task
    await db.update(tasks).set({
      status: newStatus as any,
      closedAt: now,
    }).where(eq(tasks.id, taskId));

    // Update owner rating: increment-based average
    // Find the agent owner
    if (task.agentId) {
      const [agent] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
      if (agent) {
        const ratingDelta = feedbackType === FeedbackType.Satisfied ? 5.0 : 3.0;
        // Simple moving average: new_rating = (old_rating * total_tasks + new_score) / (total_tasks + 1)
        // We use a simplified approach: just update toward the new score
        await db.update(ownerProfiles).set({
          ratingAsOwner: sql`ROUND(LEAST(5, GREATEST(0,
            (COALESCE(${ownerProfiles.ratingAsOwner}::numeric, 0) * COALESCE((SELECT total_tasks FROM agents WHERE owner_id = ${agent.ownerId}), 0) + ${ratingDelta})
            / (COALESCE((SELECT total_tasks FROM agents WHERE owner_id = ${agent.ownerId}), 0) + 1)
          )), 2)`,
        }).where(eq(ownerProfiles.userId, agent.ownerId));

        // Increment agent total_tasks
        await db.update(agents).set({
          totalTasks: sql`${agents.totalTasks} + 1`,
        }).where(eq(agents.id, task.agentId));
      }
    }

    // Calculate settlement: platformFee = 20%, ownerNet = 80%
    const baseFeeNum = parseFloat(task.baseFee ?? '0');
    // Look up tip for this task
    const [tip] = await db.select().from(paymentTips)
      .where(eq(paymentTips.taskId, taskId)).limit(1);
    const tipNum = tip ? parseFloat(tip.amount) : 0;
    const total = baseFeeNum + tipNum;
    const platformFee = (total * 0.2).toFixed(2);
    const ownerNet = (total * 0.8).toFixed(2);

    // Find agent owner for ownerId
    let settlementOwnerId: string | null = null;
    if (task.agentId) {
      const [ag] = await db.select().from(agents).where(eq(agents.id, task.agentId)).limit(1);
      if (ag) settlementOwnerId = ag.ownerId;
    }

    // Complete settlement with fee calculation
    await db.update(settlements).set({
      status: SettlementStatus.Completed,
      completedAt: now,
      tipAmount: tipNum.toFixed(2),
      platformFee,
      ownerNet,
      ownerId: settlementOwnerId,
    }).where(eq(settlements.taskId, taskId));
  } else {
    // unsatisfied → disputed (48h dispute window)
    newStatus = TaskStatus.Disputed;

    await db.update(tasks).set({
      status: newStatus as any,
    }).where(eq(tasks.id, taskId));
  }

  // Audit log
  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'feedback',
    actorId: userId,
    actorRole: 'hirer',
    stateBefore: TaskStatus.BaseFeePaid,
    stateAfter: newStatus,
    metadata: { feedbackType, feedbackId: fb.id },
  });

  const [updated] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return c.json({ task: updated, feedback: fb });
});

// === TIP ===

const TIP_PRESETS = [3, 9, 19];
const TIP_MIN = 1;
const TIP_MAX = 200;

const TIPPABLE_STATUSES: string[] = [
  TaskStatus.Satisfied,
  TaskStatus.Partial,
  TaskStatus.Closed,
];

// POST /tasks/:id/tip - hirer tips agent owner
tasksRouter.post('/:id/tip', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const body = await c.req.json().catch(() => ({}));
  const rawAmount = Number(body.amount);
  if (!Number.isFinite(rawAmount) || rawAmount < TIP_MIN || rawAmount > TIP_MAX) {
    return c.json({ error: `Tip amount must be between ${TIP_MIN} and ${TIP_MAX}` }, 400);
  }
  // Round to 2 decimal places
  const amount = Math.round(rawAmount * 100) / 100;

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (!TIPPABLE_STATUSES.includes(task.status)) {
    return c.json({ error: `Cannot tip: task status is '${task.status}', expected one of: ${TIPPABLE_STATUSES.join(', ')}` }, 400);
  }

  // Insert tip record
  const [tip] = await db.insert(paymentTips).values({
    taskId,
    hirerId: userId,
    amount: amount.toFixed(2),
  }).returning();

  // Update settlement tipAmount (accumulate)
  await db.update(settlements).set({
    tipAmount: sql`COALESCE(${settlements.tipAmount}, 0) + ${amount.toFixed(2)}::decimal`,
  }).where(eq(settlements.taskId, taskId));

  // Audit log
  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'tip',
    actorId: userId,
    actorRole: 'hirer',
    stateBefore: task.status,
    stateAfter: task.status,
    metadata: { tipId: tip.id, amount: amount.toFixed(2) },
  });

  return c.json({ tip }, 201);
});

// === DISPUTE FLOW ===

// POST /tasks/:id/dispute - hirer disputes unsatisfied task
tasksRouter.post('/:id/dispute', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.hirerId !== userId) return c.json({ error: 'Forbidden' }, 403);
  if (task.status !== TaskStatus.Unsatisfied) {
    return c.json({ error: `Cannot dispute: task status is '${task.status}', expected 'unsatisfied'` }, 400);
  }

  // Check 48h dispute window from feedback creation
  const [fb] = await db.select().from(feedback)
    .where(eq(feedback.taskId, taskId))
    .orderBy(sql`${feedback.createdAt} DESC`)
    .limit(1);

  if (fb) {
    const disputeWindowMs = 48 * 60 * 60 * 1000;
    if (Date.now() - new Date(fb.createdAt).getTime() > disputeWindowMs) {
      return c.json({ error: 'Dispute window expired: must dispute within 48 hours of feedback' }, 400);
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const reason = body.reason ?? null;

  // Update task status
  const [updated] = await db.update(tasks).set({
    status: TaskStatus.Disputed,
  }).where(eq(tasks.id, taskId)).returning();

  // Update settlement status to disputed
  await db.update(settlements).set({
    status: SettlementStatus.Disputed,
  }).where(eq(settlements.taskId, taskId));

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'dispute',
    actorId: userId,
    actorRole: 'hirer',
    stateBefore: TaskStatus.Unsatisfied,
    stateAfter: TaskStatus.Disputed,
    metadata: { reason },
  });

  return c.json(updated);
});

// POST /tasks/:id/resolve - platform resolves disputed task
tasksRouter.post('/:id/resolve', async (c) => {
  const { userId } = c.get('user');
  const taskId = c.req.param('id');
  const db = getDb();

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: 'Task not found' }, 404);
  if (task.status !== TaskStatus.Disputed) {
    return c.json({ error: `Cannot resolve: task status is '${task.status}', expected 'disputed'` }, 400);
  }

  const body = await c.req.json();
  const resolution = body.resolution as string | undefined; // 'refunded' | 'closed' | 'completed' etc.
  const settlementUpdate = body.settlement as Record<string, any> | undefined;

  if (!resolution) {
    return c.json({ error: 'Missing required field: resolution' }, 400);
  }

  // Validate resolution is a valid terminal TaskStatus
  const VALID_RESOLUTIONS: string[] = [
    TaskStatus.Closed,
    TaskStatus.Refunded,
  ];
  if (!VALID_RESOLUTIONS.includes(resolution)) {
    return c.json({ error: `Invalid resolution: must be one of ${VALID_RESOLUTIONS.join(', ')}` }, 400);
  }

  // Update task to terminal state
  const [updated] = await db.update(tasks).set({
    status: resolution as any,
    closedAt: new Date(),
  }).where(eq(tasks.id, taskId)).returning();

  // Update settlement based on resolution
  if (resolution === TaskStatus.Refunded) {
    // Refund the deposit
    const [deposit] = await db.select().from(paymentDeposits)
      .where(and(eq(paymentDeposits.taskId, taskId), eq(paymentDeposits.status, PaymentDepositStatus.Paid)))
      .limit(1);

    if (deposit) {
      await db.update(paymentDeposits).set({
        status: PaymentDepositStatus.Refunded,
        refundReason: RefundReason.System,
        refundedAt: new Date(),
      }).where(eq(paymentDeposits.id, deposit.id));
    }

    await db.update(settlements).set({
      status: SettlementStatus.Reversed,
      ...(settlementUpdate ?? {}),
    }).where(eq(settlements.taskId, taskId));
  } else {
    // Closed — mark settlement as completed
    await db.update(settlements).set({
      status: SettlementStatus.Completed,
      completedAt: new Date(),
      ...(settlementUpdate ?? {}),
    }).where(eq(settlements.taskId, taskId));
  }

  const auditTask = createAuditLog('task');
  auditTask({
    entityId: taskId,
    eventType: 'resolve_dispute',
    actorId: userId,
    actorRole: 'platform',
    stateBefore: TaskStatus.Disputed,
    stateAfter: resolution,
    metadata: { resolution, settlementUpdate },
  });

  return c.json(updated);
});

export default tasksRouter;
