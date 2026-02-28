import { Hono } from 'hono';
import { eq, desc, asc, sql, and, arrayContains } from 'drizzle-orm';
import { getDb, agents, tasks } from '@hireclaw/db';
import { createAuditLog } from '../middleware/audit.js';
import { AgentStatus } from '@hireclaw/shared/enums';
import { authMiddleware, type AuthEnv } from '../middleware/auth.js';
import {
  createAgentSchema,
  updateAgentSchema,
  listAgentsSchema,
  patchStatusSchema,
} from '../validators/agent.js';

// === Agent Status Machine (MVP: simplified, no provisioning) ===
const VALID_TRANSITIONS: Record<string, string[]> = {
  [AgentStatus.Registered]: [AgentStatus.Online],
  [AgentStatus.Online]: [AgentStatus.Busy, AgentStatus.Offline, AgentStatus.Error, AgentStatus.Suspended],
  [AgentStatus.Busy]: [AgentStatus.Online, AgentStatus.Error, AgentStatus.Suspended],
  [AgentStatus.Offline]: [AgentStatus.Online],
  [AgentStatus.Error]: [AgentStatus.Registered, AgentStatus.Online],
  [AgentStatus.Suspended]: [AgentStatus.Registered],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

const agentsRoute = new Hono<AuthEnv>();

// Health check - PUBLIC (no auth required, for external monitoring)
agentsRoute.get('/:id/health', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const [agent] = await db.select({
    id: agents.id,
    status: agents.status,
    lastHeartbeatAt: agents.lastHeartbeatAt,
    heartbeatFailCount: agents.heartbeatFailCount,
    currentLoad: agents.currentLoad,
    maxLoad: agents.maxLoad,
  }).from(agents).where(eq(agents.id, id)).limit(1);

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json({
    id: agent.id,
    status: agent.status,
    lastHeartbeatAt: agent.lastHeartbeatAt,
    heartbeatFailCount: agent.heartbeatFailCount,
    currentLoad: agent.currentLoad,
    maxLoad: agent.maxLoad,
  });
});

// All OTHER agent routes require auth
agentsRoute.use('*', authMiddleware);

// POST /agents - Create agent
agentsRoute.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { userId } = c.get('user');
  const db = getDb();

  const [agent] = await db.insert(agents).values({
    ownerId: userId,
    name: parsed.data.name,
    description: parsed.data.description,
    capabilities: parsed.data.capabilities,
    maxLoad: parsed.data.maxLoad ?? 1,
    resourceType: parsed.data.resourceType,
    resourceEndpoint: parsed.data.resourceEndpoint,
    availability: parsed.data.availability,
  }).returning();

  return c.json(agent, 201);
});

// GET /agents - List agents
agentsRoute.get('/', async (c) => {
  const query = listAgentsSchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: 'Validation failed', details: query.error.flatten() }, 400);
  }

  const { status, capability, sortBy, order, limit = 20, offset = 0 } = query.data;
  const db = getDb();

  const conditions = [];

  // Default to online if no status filter
  const statusFilter = status ?? AgentStatus.Online;
  conditions.push(eq(agents.status, statusFilter as any));

  if (capability) {
    conditions.push(arrayContains(agents.capabilities, [capability]));
  }

  const orderDir = order === 'asc' ? asc : desc;
  const orderCol = sortBy === 'rating' ? agents.rating
    : sortBy === 'totalTasks' ? agents.totalTasks
    : agents.createdAt;

  const results = await db
    .select()
    .from(agents)
    .where(and(...conditions))
    .orderBy(orderDir(orderCol))
    .limit(limit)
    .offset(offset);

  return c.json({ data: results, limit, offset });
});

// GET /agents/:id - Agent detail
agentsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  const [agent] = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  return c.json(agent);
});

// PUT /agents/:id - Update agent
agentsRoute.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { userId } = c.get('user');
  const body = await c.req.json();
  const parsed = updateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const db = getDb();

  // Verify ownership
  const [existing] = await db.select({ ownerId: agents.ownerId }).from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  if (existing.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const data = parsed.data;
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.capabilities !== undefined) updates.capabilities = data.capabilities;
  if (data.maxLoad !== undefined) updates.maxLoad = data.maxLoad;
  if (data.resourceType !== undefined) updates.resourceType = data.resourceType;
  if (data.resourceEndpoint !== undefined) updates.resourceEndpoint = data.resourceEndpoint;
  if (data.availability !== undefined) updates.availability = data.availability;

  const [updated] = await db.update(agents).set(updates).where(eq(agents.id, id)).returning();
  return c.json(updated);
});

// PATCH /agents/:id/status - Update agent status with state machine validation
agentsRoute.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const { userId } = c.get('user');
  const body = await c.req.json();
  const parsed = patchStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const db = getDb();

  const [existing] = await db.select({ ownerId: agents.ownerId, status: agents.status })
    .from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  if (existing.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const newStatus = parsed.data.status;
  if (!isValidTransition(existing.status, newStatus)) {
    return c.json({
      error: `Invalid status transition from '${existing.status}' to '${newStatus}'`,
      allowed: VALID_TRANSITIONS[existing.status] ?? [],
    }, 400);
  }

  const [updated] = await db.update(agents)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();

  // Write audit log (fire-and-forget)
  const auditAgent = createAuditLog('agent');
  auditAgent({
    entityId: id,
    eventType: 'status_change',
    actorId: userId,
    actorRole: 'owner',
    stateBefore: existing.status,
    stateAfter: newStatus,
  });

  return c.json(updated);
});

// POST /agents/:id/heartbeat - Agent heartbeat
agentsRoute.post('/:id/heartbeat', async (c) => {
  const id = c.req.param('id');
  const { userId } = c.get('user');
  const db = getDb();

  const [existing] = await db.select({ ownerId: agents.ownerId, status: agents.status })
    .from(agents).where(eq(agents.id, id)).limit(1);
  if (!existing) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  if (existing.ownerId !== userId) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const now = new Date();
  const [updated] = await db.update(agents)
    .set({
      lastHeartbeatAt: now,
      heartbeatFailCount: 0,
      updatedAt: now,
    })
    .where(eq(agents.id, id))
    .returning();

  return c.json({ ok: true, lastHeartbeatAt: updated.lastHeartbeatAt });
});

// GET /agents/:id/tasks - Agent task history
agentsRoute.get('/:id/tasks', async (c) => {
  const id = c.req.param('id');
  const db = getDb();

  // Verify agent exists
  const [agent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.id, id)).limit(1);
  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404);
  }

  const limit = Math.min(Number(c.req.query('limit') || 20), 100);
  const offset = Number(c.req.query('offset') || 0);

  const results = await db
    .select()
    .from(tasks)
    .where(eq(tasks.agentId, id))
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: results, limit, offset });
});

export default agentsRoute;
