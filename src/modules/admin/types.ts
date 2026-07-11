export type AdminPermissionCode = string;

export interface AdminActorView {
  id: string;
  name: string | null;
  email: string | null;
  permissions: readonly AdminPermissionCode[];
}

export type AdminDataState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'empty' }
  | { kind: 'unavailable'; reason?: string }
  | { kind: 'error'; message: string };

export type SystemHealth = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

export interface AdminSystemStatus {
  id: 'server' | 'database' | 'redis' | 'queue';
  label: string;
  status: SystemHealth;
  detail?: string;
}

export interface AdminMetric {
  id: 'users' | 'orders' | 'revenue' | 'products';
  label: string;
  value: number | null;
  description: string;
  format?: 'number' | 'currency';
}

export interface AdminAuditActivity {
  id: string;
  actorName: string | null;
  action: string;
  resource: string;
  createdAt: string;
}

export interface AdminDashboardData {
  metrics: readonly AdminMetric[];
  system: readonly AdminSystemStatus[];
  activities: readonly AdminAuditActivity[];
}

export interface AdminListPageData<T> {
  rows: readonly T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  roles: readonly string[];
  createdAt: string;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  effectivePermissions: readonly string[];
  activity: readonly AdminAuditActivity[];
}

export interface AdminRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
  updatedAt: string;
}

export interface AdminPermissionRow {
  id: string;
  code: string;
  group: string;
  description: string | null;
  roleCount: number;
}

export interface AdminSettingRow {
  id: string;
  key: string;
  category: 'GENERAL' | 'SECURITY' | 'NOTIFICATION' | 'STORAGE' | 'APPLICATION';
  version: number;
  updatedAt: string;
  isSensitive: boolean;
}

export interface AdminMediaRow {
  id: string;
  originalName: string;
  contentType: string;
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  bytes: number;
  url: string | null;
  metadata: {
    alt: string | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    pages: number | null;
  } | null;
  createdAt: string;
}

export interface AdminNotificationRow {
  id: string;
  title: string;
  body: string;
  category: string;
  channel: 'INTERNAL' | 'EMAIL' | 'SMS' | 'PUSH';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'SENT' | 'READ' | 'FAILED';
  createdAt: string;
}

export interface AdminAuditRow {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string;
  ipAddress: string | null;
  createdAt: string;
}
