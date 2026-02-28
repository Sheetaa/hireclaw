import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:3000';

describe('HireClaw API Core Flow', () => {
  let tokenOwner = '';
  let tokenHirer = '';
  let agentId = '';
  let taskId = '';

  const unique = Date.now();
  const ownerEmail = `owner${unique}@test.com`;
  const hirerEmail = `hirer${unique}@test.com`;
  const password = 'Test1234!';

  it('should complete full task lifecycle', async () => {
    // 1. Register Owner
    const ownerRes = await request(BASE_URL)
      .post('/auth/register')
      .send({ email: ownerEmail, password, name: 'Test Owner', role: 'owner' });
    expect(ownerRes.status).toBe(201);
    tokenOwner = ownerRes.body.token;
    expect(tokenOwner).toBeDefined();

    // 2. Register Hirer
    const hirerRes = await request(BASE_URL)
      .post('/auth/register')
      .send({ email: hirerEmail, password, name: 'Test Hirer', role: 'hirer' });
    expect(hirerRes.status).toBe(201);
    tokenHirer = hirerRes.body.token;
    expect(tokenHirer).toBeDefined();

    // 3. Owner: Create Agent
    const agentRes = await request(BASE_URL)
      .post('/agents')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Test Agent', description: 'Test' });
    expect(agentRes.status).toBe(201);
    agentId = agentRes.body.id;

    // 4. Owner: Set Agent to online
    const onlineRes = await request(BASE_URL)
      .patch(`/agents/${agentId}/status`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ status: 'online' });
    expect(onlineRes.status).toBe(200);
    expect(onlineRes.body.status).toBe('online');

    // 5. Hirer: Create Task (draft)
    const taskRes = await request(BASE_URL)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ title: 'Test Task', description: 'Test', taskType: 'research' });
    expect(taskRes.status).toBe(201);
    taskId = taskRes.body.id;
    expect(taskRes.body.status).toBe('draft');

    // 6. Hirer: Assign Agent (draft → agent_assigned)
    const assignRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/assign-agent`)
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ agentId });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.status).toBe('agent_assigned');

    // 7. Hirer: Pay Deposit (agent_assigned → deposit_paid)
    const depositRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/deposit`)
      .set('Authorization', `Bearer ${tokenHirer}`);
    expect(depositRes.status).toBeGreaterThanOrEqual(200);
    // Verify status changed by fetching task
    const taskAfterDeposit = await request(BASE_URL)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenHirer}`);
    expect(taskAfterDeposit.body.status).toBe('deposit_paid');

    // 8. Owner: Accept (deposit_paid → running)
    const acceptRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/accept`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.status).toBe('running');

    // 9. Owner: Deliver (running → delivered)
    const deliverRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/deliver`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ deliverables: { result: 'test' } });
    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.status).toBe('delivered');

    // 10. Hirer: Pay Base Fee (delivered → base_fee_paid)
    const baseFeeRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/pay-base-fee`)
      .set('Authorization', `Bearer ${tokenHirer}`);
    expect(baseFeeRes.status).toBe(200);
    expect(baseFeeRes.body.status).toBe('base_fee_paid');

    // 11. Get task final status
    const finalRes = await request(BASE_URL)
      .get(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${tokenHirer}`);
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.status).toBe('base_fee_paid');
  }, 30000);

  it('should reject accept without deposit', async () => {
    // Create a new task for this test - assign but don't deposit
    const taskRes = await request(BASE_URL)
      .post('/tasks')
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ title: 'Reject Test', description: 'Test', taskType: 'content' });
    const newTaskId = taskRes.body.id;

    // Assign agent (draft → agent_assigned)
    await request(BASE_URL)
      .post(`/tasks/${newTaskId}/assign-agent`)
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ agentId });

    // Try to accept without deposit - should fail (need deposit_paid)
    const acceptRes = await request(BASE_URL)
      .post(`/tasks/${newTaskId}/accept`)
      .set('Authorization', `Bearer ${tokenOwner}`);
    expect(acceptRes.status).toBe(400);
    // Error should mention status requirement
    expect(acceptRes.body.error).toMatch(/status/);
  }, 15000);

  it('should allow health check without auth', async () => {
    const healthRes = await request(BASE_URL)
      .get(`/agents/${agentId}/health`);
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('online');
  }, 10000);
});
