import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:3000';

/** Helper: create full task flow up to base_fee_paid */
async function createTaskToBaseFeeePaid(unique: string) {
  const ownerEmail = `owner_p3_${unique}@test.com`;
  const hirerEmail = `hirer_p3_${unique}@test.com`;
  const password = 'Test1234!';

  // Register owner & hirer
  const ownerRes = await request(BASE_URL)
    .post('/auth/register')
    .send({ email: ownerEmail, password, name: 'P3 Owner', role: 'owner' });
  expect(ownerRes.status).toBe(201);
  const tokenOwner = ownerRes.body.token;

  const hirerRes = await request(BASE_URL)
    .post('/auth/register')
    .send({ email: hirerEmail, password, name: 'P3 Hirer', role: 'hirer' });
  expect(hirerRes.status).toBe(201);
  const tokenHirer = hirerRes.body.token;

  // Create agent
  const agentRes = await request(BASE_URL)
    .post('/agents')
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ name: 'P3 Agent', description: 'Test agent' });
  expect(agentRes.status).toBe(201);
  const agentId = agentRes.body.id;

  // Set agent online
  await request(BASE_URL)
    .patch(`/agents/${agentId}/status`)
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ status: 'online' });

  // Create task
  const taskRes = await request(BASE_URL)
    .post('/tasks')
    .set('Authorization', `Bearer ${tokenHirer}`)
    .send({ title: 'P3 Task', description: 'Test', taskType: 'research' });
  expect(taskRes.status).toBe(201);
  const taskId = taskRes.body.id;

  // Assign agent
  await request(BASE_URL)
    .post(`/tasks/${taskId}/assign-agent`)
    .set('Authorization', `Bearer ${tokenHirer}`)
    .send({ agentId });

  // Pay deposit
  await request(BASE_URL)
    .post(`/tasks/${taskId}/deposit`)
    .set('Authorization', `Bearer ${tokenHirer}`);

  // Accept
  await request(BASE_URL)
    .post(`/tasks/${taskId}/accept`)
    .set('Authorization', `Bearer ${tokenOwner}`);

  // Deliver
  await request(BASE_URL)
    .post(`/tasks/${taskId}/deliver`)
    .set('Authorization', `Bearer ${tokenOwner}`)
    .send({ deliverables: { result: 'done' } });

  // Pay base fee
  const bfRes = await request(BASE_URL)
    .post(`/tasks/${taskId}/pay-base-fee`)
    .set('Authorization', `Bearer ${tokenHirer}`);
  expect(bfRes.status).toBe(200);
  expect(bfRes.body.status).toBe('base_fee_paid');

  return { taskId, tokenOwner, tokenHirer, agentId };
}

describe('P3: Feedback, Tip, Dispute', () => {

  it('feedback (satisfied) → closed', async () => {
    const { taskId, tokenHirer } = await createTaskToBaseFeeePaid(`sat_${Date.now()}`);

    const fbRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/feedback`)
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ type: 'satisfied', comment: 'Great work!' });

    expect(fbRes.status).toBe(200);
    expect(fbRes.body.task.status).toBe('closed');
    expect(fbRes.body.feedback).toBeDefined();
    expect(fbRes.body.feedback.type).toBe('satisfied');
  }, 30000);

  it('tip on closed task', async () => {
    const { taskId, tokenHirer } = await createTaskToBaseFeeePaid(`tip_${Date.now()}`);

    // Close task first via satisfied feedback
    await request(BASE_URL)
      .post(`/tasks/${taskId}/feedback`)
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ type: 'satisfied', comment: 'Good' });

    // Now tip
    const tipRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/tip`)
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ amount: 9 });

    expect(tipRes.status).toBe(201);
    expect(tipRes.body.tip).toBeDefined();
    expect(parseFloat(tipRes.body.tip.amount)).toBe(9);
  }, 30000);

  it('feedback (unsatisfied) → disputed', async () => {
    const { taskId, tokenHirer } = await createTaskToBaseFeeePaid(`dis_${Date.now()}`);

    const fbRes = await request(BASE_URL)
      .post(`/tasks/${taskId}/feedback`)
      .set('Authorization', `Bearer ${tokenHirer}`)
      .send({ type: 'unsatisfied', comment: 'Not what I expected' });

    expect(fbRes.status).toBe(200);
    expect(fbRes.body.task.status).toBe('disputed');
    expect(fbRes.body.feedback.type).toBe('unsatisfied');
  }, 30000);
});
