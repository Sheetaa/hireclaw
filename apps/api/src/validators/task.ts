import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  taskType: z.enum(['research', 'content', 'data']),
  complexityLevel: z.enum(['L1', 'L2', 'L3', 'L4']).optional(),
  baseFee: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  depositAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const listTasksSchema = z.object({
  role: z.enum(['hirer', 'agent_owner']).optional(),
  status: z.enum([
    'draft', 'agent_assigned', 'deposit_paid', 'running', 'blocked',
    'delivered', 'base_fee_paid', 'satisfied', 'partial', 'unsatisfied',
    'disputed', 'closed', 'refunded', 'rejected', 'cancelled',
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const assignAgentSchema = z.object({
  agentId: z.string().uuid(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type ListTasksInput = z.infer<typeof listTasksSchema>;
export type AssignAgentInput = z.infer<typeof assignAgentSchema>;
