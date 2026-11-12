export type UserRole = 'admin' | 'manager' | 'viewer';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SourceSchemaType = 'web_form' | 'crm' | 'partner' | 'generic';

export interface Source {
  _id: string;
  name: string;
  description: string;
  schemaType: SourceSchemaType;
  apiKeyPrefix: string;
  active: boolean;
  secretRotatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type EventStatus =
  | 'received'
  | 'valid'
  | 'invalid'
  | 'processed'
  | 'failed'
  | 'dead_letter';

export interface EventErrorItem {
  field: string;
  message: string;
  code: string;
}

export interface ProcessingLogItem {
  timestamp: string;
  stage: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface NormalizedRecord {
  _id: string;
  sourceId: string;
  eventId: string;
  externalId: string;
  clientName: string;
  clientEmail: string;
  company: string;
  phone: string;
  category: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  normalizedAt: string;
  source?: Pick<Source, '_id' | 'name' | 'schemaType' | 'active'>;
}

export interface WorkflowEvent {
  _id: string;
  sourceId: string | Pick<Source, '_id' | 'name' | 'schemaType' | 'active'>;
  source?: Pick<Source, '_id' | 'name' | 'schemaType' | 'active'>;
  payload: Record<string, unknown>;
  status: EventStatus;
  errors: EventErrorItem[];
  processingLogs: ProcessingLogItem[];
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  deadLetteredAt: string | null;
  receivedAt: string;
  processedAt: string | null;
  recordId: string | NormalizedRecord | null;
}

export interface AuditLogItem {
  _id: string;
  actorId: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface MetricsSummary {
  total: number;
  counts: Record<EventStatus, number>;
  successRate: number;
  avgProcessingMs: number;
  bySource: Array<{
    sourceId: string;
    sourceName: string;
    schemaType: SourceSchemaType;
    active: boolean;
    total: number;
    processed: number;
    invalid: number;
    failed: number;
    dead_letter: number;
  }>;
  range: {
    from: string | null;
    to: string | null;
    sourceId: string | null;
  };
}

export interface MetricsTimeSeries {
  granularity: 'day' | 'hour';
  buckets: Array<{
    bucket: string;
    total: number;
    received: number;
    valid: number;
    processed: number;
    invalid: number;
    failed: number;
    dead_letter: number;
  }>;
}

