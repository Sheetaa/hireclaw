import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  jsonb,
  pgEnum,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Enums imported from shared package
import {
  UserRole,
  UserStatus,
  AgentStatus,
  AgentResourceType,
  TaskStatus,
  TaskType,
  ComplexityLevel,
  PaymentDepositStatus,
  RefundReason,
  SettlementStatus,
  FeedbackType,
  ActorRole,
} from '@hireclaw/shared/enums';

// === USER ===
export const userRoleEnum = pgEnum('user_role', [
  UserRole.Owner,
  UserRole.Hirer,
  UserRole.Dual,
]);

export const userStatusEnum = pgEnum('user_status', [
  UserStatus.Active,
  UserStatus.Suspended,
  UserStatus.Deleted,
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    avatarUrl: varchar('avatar_url', { length: 500 }),
    role: userRoleEnum('role').array().notNull(),
    status: userStatusEnum('status').notNull().default(UserStatus.Active),
    emailVerified: boolean('email_verified').default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    statusIdx: index('users_status_idx').on(table.status),
  })
);

// === OWNER_PROFILE ===
export const ownerProfiles = pgTable(
  'owner_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    bio: text('bio'),
    payoutInfo: jsonb('payout_info'), // { bank, alipay, paypal, etc }
    totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 }).default(
      '0'
    ),
    availableBalance: decimal('available_balance', {
      precision: 12,
      scale: 2,
    }).default('0'),
    ratingAsOwner: decimal('rating_as_owner', { precision: 3, scale: 2 }).default(
      '0'
    ),
  },
  (table) => ({
    userIdx: index('owner_profiles_user_idx').on(table.userId),
  })
);

// === HIRER_PROFILE ===
export const hirerProfiles = pgTable(
  'hirer_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    bio: text('bio'),
    paymentMethod: jsonb('payment_method'), // { card, stripe, etc }
    totalSpent: decimal('total_spent', { precision: 12, scale: 2 }).default('0'),
    ratingAsHirer: decimal('rating_as_hirer', {
      precision: 3,
      scale: 2,
    }).default('0'),
  },
  (table) => ({
    userIdx: index('hirer_profiles_user_idx').on(table.userId),
  })
);

// === AGENT ===
export const agentStatusEnum = pgEnum('agent_status', [
  AgentStatus.Registered,
  AgentStatus.Provisioning,
  AgentStatus.Online,
  AgentStatus.Busy,
  AgentStatus.Offline,
  AgentStatus.Error,
  AgentStatus.Suspended,
]);

export const agentResourceTypeEnum = pgEnum('agent_resource_type', [
  AgentResourceType.DockerLocal,
  AgentResourceType.Cloud,
]);

export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    capabilities: text('capabilities').array(), // ability tags
    status: agentStatusEnum('status').notNull().default(AgentStatus.Registered),
    availability: jsonb('availability'), // { schedule, timezone, etc }
    rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
    totalTasks: integer('total_tasks').default(0),
    maxLoad: integer('max_load').notNull().default(1),
    currentLoad: integer('current_load').default(0),
    resourceType: agentResourceTypeEnum('resource_type'),
    resourceEndpoint: varchar('resource_endpoint', { length: 500 }),
    lastHeartbeatAt: timestamp('last_heartbeat_at'),
    heartbeatFailCount: integer('heartbeat_fail_count').default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
  },
  (table) => ({
    ownerIdx: index('agents_owner_idx').on(table.ownerId),
    statusIdx: index('agents_status_idx').on(table.status),
    ratingIdx: index('agents_rating_idx').on(table.rating),
  })
);

// === TASK ===
export const taskStatusEnum = pgEnum('task_status', [
  TaskStatus.Draft,
  TaskStatus.AgentAssigned,
  TaskStatus.DepositPaid,
  TaskStatus.Running,
  TaskStatus.Blocked,
  TaskStatus.Delivered,
  TaskStatus.BaseFeePaid,
  TaskStatus.Satisfied,
  TaskStatus.Partial,
  TaskStatus.Unsatisfied,
  TaskStatus.Disputed,
  TaskStatus.Closed,
  TaskStatus.Refunded,
  TaskStatus.Rejected,
  TaskStatus.Cancelled,
]);

export const taskTypeEnum = pgEnum('task_type', [
  TaskType.Research,
  TaskType.Content,
  TaskType.Data,
]);

export const complexityLevelEnum = pgEnum('complexity_level', [
  ComplexityLevel.L1,
  ComplexityLevel.L2,
  ComplexityLevel.L3,
  ComplexityLevel.L4,
]);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hirerId: uuid('hirer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    taskType: taskTypeEnum('task_type').notNull(),
    complexityLevel: complexityLevelEnum('complexity_level'),
    baseFee: decimal('base_fee', { precision: 12, scale: 2 }),
    depositAmount: decimal('deposit_amount', { precision: 12, scale: 2 }),
    status: taskStatusEnum('status').notNull().default(TaskStatus.Draft),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    depositPaidAt: timestamp('deposit_paid_at'),
    agentAssignedAt: timestamp('agent_assigned_at'),
    acceptedAt: timestamp('accepted_at'),
    deliveredAt: timestamp('delivered_at'),
    blockedAt: timestamp('blocked_at'),
    baseFeePaidAt: timestamp('base_fee_paid_at'),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    hirerIdx: index('tasks_hirer_idx').on(table.hirerId),
    agentIdx: index('tasks_agent_idx').on(table.agentId),
    statusIdx: index('tasks_status_idx').on(table.status),
    hirerStatusIdx: index('tasks_hirer_status_idx').on(
      table.hirerId,
      table.status
    ),
  })
);

// === PAYMENT_TIP ===
export const paymentTips = pgTable(
  'payment_tips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    hirerId: uuid('hirer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    taskIdx: index('payment_tips_task_idx').on(table.taskId),
    hirerIdx: index('payment_tips_hirer_idx').on(table.hirerId),
  })
);

// === PAYMENT_DEPOSIT ===
export const paymentDepositStatusEnum = pgEnum('payment_deposit_status', [
  PaymentDepositStatus.Pending,
  PaymentDepositStatus.Paid,
  PaymentDepositStatus.Refunded,
  PaymentDepositStatus.Forfeited,
]);

export const refundReasonEnum = pgEnum('refund_reason', [
  RefundReason.HirerCancelled,
  RefundReason.AgentBlockedTimeout,
  RefundReason.TaskRejected,
  RefundReason.System,
]);

export const paymentDeposits = pgTable(
  'payment_deposits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    hirerId: uuid('hirer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    status: paymentDepositStatusEnum('status').notNull().default(
      PaymentDepositStatus.Pending
    ),
    refundReason: refundReasonEnum('refund_reason'),
    paidAt: timestamp('paid_at'),
    refundedAt: timestamp('refunded_at'),
    forfeitedAt: timestamp('forfeited_at'),
    forfeitedPlatformShare: decimal('forfeited_platform_share', {
      precision: 12,
      scale: 2,
    }),
    forfeitedOwnerShare: decimal('forfeited_owner_share', {
      precision: 12,
      scale: 2,
    }),
  },
  (table) => ({
    taskIdx: index('payment_deposits_task_idx').on(table.taskId),
    hirerIdx: index('payment_deposits_hirer_idx').on(table.hirerId),
    statusIdx: index('payment_deposits_status_idx').on(table.status),
  })
);

// === SETTLEMENT ===
export const settlementStatusEnum = pgEnum('settlement_status', [
  SettlementStatus.Pending,
  SettlementStatus.BaseFeePaid,
  SettlementStatus.Completed,
  SettlementStatus.Reversed,
  SettlementStatus.Disputed,
]);

export const settlements = pgTable(
  'settlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    ownerId: uuid('owner_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    depositId: uuid('deposit_id')
      .notNull()
      .references(() => paymentDeposits.id, { onDelete: 'cascade' }),
    baseFee: decimal('base_fee', { precision: 12, scale: 2 }),
    tipAmount: decimal('tip_amount', { precision: 12, scale: 2 }).default('0'),
    platformFee: decimal('platform_fee', { precision: 12, scale: 2 }).default(
      '0'
    ),
    ownerNet: decimal('owner_net', { precision: 12, scale: 2 }).default('0'),
    status: settlementStatusEnum('status').notNull().default(
      SettlementStatus.Pending
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    baseFeePaidAt: timestamp('base_fee_paid_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    taskIdx: index('settlements_task_idx').on(table.taskId),
    ownerIdx: index('settlements_owner_idx').on(table.ownerId),
    depositIdx: index('settlements_deposit_idx').on(table.depositId),
    statusIdx: index('settlements_status_idx').on(table.status),
  })
);

// === FEEDBACK ===
export const feedbackTypeEnum = pgEnum('feedback_type', [
  FeedbackType.Satisfied,
  FeedbackType.Partial,
  FeedbackType.Unsatisfied,
]);

// Note: reason_category is array of enums - using text array for simplicity
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    type: feedbackTypeEnum('type').notNull(),
    reasonCategory: text('reason_category').array(), // unsatisfied reasons
    reasonText: text('reason_text'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    taskIdx: index('feedback_task_idx').on(table.taskId),
    typeIdx: index('feedback_type_idx').on(table.type),
  })
);

// === TASK_AUDIT_LOG ===
export const taskAuditLog = pgTable(
  'task_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    actorRole: varchar('actor_role', { length: 20 }).notNull(), // owner/hirer/system
    stateBefore: varchar('state_before', { length: 50 }),
    stateAfter: varchar('state_after', { length: 50 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    taskIdx: index('task_audit_log_task_idx').on(table.taskId),
    eventTypeIdx: index('task_audit_log_event_idx').on(table.eventType),
    timestampIdx: index('task_audit_log_timestamp_idx').on(table.timestamp),
  })
);

// === AGENT_AUDIT_LOG ===
export const agentAuditLog = pgTable(
  'agent_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    actorRole: varchar('actor_role', { length: 20 }).notNull(), // owner/system
    stateBefore: varchar('state_before', { length: 50 }),
    stateAfter: varchar('state_after', { length: 50 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    agentIdx: index('agent_audit_log_agent_idx').on(table.agentId),
    eventTypeIdx: index('agent_audit_log_event_idx').on(table.eventType),
    timestampIdx: index('agent_audit_log_timestamp_idx').on(table.timestamp),
  })
);

// Type exports for queries
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
export type PaymentDeposit = typeof paymentDeposits.$inferSelect;
export type NewPaymentDeposit = typeof paymentDeposits.$inferInsert;
export type PaymentTip = typeof paymentTips.$inferSelect;
export type NewPaymentTip = typeof paymentTips.$inferInsert;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type TaskAuditLog = typeof taskAuditLog.$inferSelect;
export type NewTaskAuditLog = typeof taskAuditLog.$inferInsert;
export type AgentAuditLog = typeof agentAuditLog.$inferSelect;
export type NewAgentAuditLog = typeof agentAuditLog.$inferInsert;
