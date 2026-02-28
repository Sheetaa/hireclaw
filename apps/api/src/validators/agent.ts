import { z } from 'zod';
import { AgentStatus, AgentResourceType } from '@hireclaw/shared/enums';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  capabilities: z.array(z.string().min(1).max(100)).max(20).optional(),
  maxLoad: z.number().int().min(1).max(100).optional(),
  resourceType: z.enum([AgentResourceType.DockerLocal, AgentResourceType.Cloud]).optional(),
  resourceEndpoint: z.string().url().max(500).optional(),
  availability: z.record(z.unknown()).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  capabilities: z.array(z.string().min(1).max(100)).max(20).optional(),
  maxLoad: z.number().int().min(1).max(100).optional(),
  resourceType: z.enum([AgentResourceType.DockerLocal, AgentResourceType.Cloud]).optional(),
  resourceEndpoint: z.string().url().max(500).optional(),
  availability: z.record(z.unknown()).optional(),
});

export const listAgentsSchema = z.object({
  status: z.enum([
    AgentStatus.Registered, AgentStatus.Provisioning, AgentStatus.Online,
    AgentStatus.Busy, AgentStatus.Offline, AgentStatus.Error, AgentStatus.Suspended,
  ]).optional(),
  capability: z.string().optional(),
  sortBy: z.enum(['rating', 'totalTasks', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const patchStatusSchema = z.object({
  status: z.enum([
    AgentStatus.Registered, AgentStatus.Provisioning, AgentStatus.Online,
    AgentStatus.Busy, AgentStatus.Offline, AgentStatus.Error, AgentStatus.Suspended,
  ]),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ListAgentsInput = z.infer<typeof listAgentsSchema>;
export type PatchStatusInput = z.infer<typeof patchStatusSchema>;
