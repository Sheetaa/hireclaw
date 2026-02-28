export enum UserRole {
  Owner = 'owner',
  Hirer = 'hirer',
  Dual = 'dual',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

export enum AgentStatus {
  Registered = 'registered',
  Provisioning = 'provisioning', // Kept for DB compatibility, not used in MVP logic
  Online = 'online',
  Busy = 'busy',
  Offline = 'offline',
  Error = 'error',
  Suspended = 'suspended',
}

export enum AgentResourceType {
  DockerLocal = 'docker_local',
  Cloud = 'cloud',
}

export enum TaskStatus {
  Draft = 'draft',
  AgentAssigned = 'agent_assigned',
  DepositPaid = 'deposit_paid',
  Running = 'running',
  Blocked = 'blocked',
  Delivered = 'delivered',
  BaseFeePaid = 'base_fee_paid',
  Satisfied = 'satisfied',
  Partial = 'partial',
  Unsatisfied = 'unsatisfied',
  Disputed = 'disputed',
  Closed = 'closed',
  Refunded = 'refunded',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum TaskType {
  Research = 'research',
  Content = 'content',
  Data = 'data',
}

export enum ComplexityLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  L4 = 'L4',
}

export enum PaymentDepositStatus {
  Pending = 'pending',
  Paid = 'paid',
  Refunded = 'refunded',
  Forfeited = 'forfeited',
}

export enum RefundReason {
  HirerCancelled = 'hirer_cancelled',
  AgentBlockedTimeout = 'agent_blocked_timeout',
  TaskRejected = 'task_rejected',
  System = 'system',
}

export enum SettlementStatus {
  Pending = 'pending',
  BaseFeePaid = 'base_fee_paid',
  Completed = 'completed',
  Reversed = 'reversed',
  Disputed = 'disputed',
}

export enum FeedbackType {
  Satisfied = 'satisfied',
  Partial = 'partial',
  Unsatisfied = 'unsatisfied',
}

export enum ActorRole {
  Owner = 'owner',
  Hirer = 'hirer',
  System = 'system',
}
