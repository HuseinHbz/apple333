import type {
  MediaKind,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  SettingCategory,
  UserStatus,
} from '@prisma/client';

export type AdminAuditContext = Readonly<{
  actorId: string;
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}>;

export type PageInput = Readonly<{
  page: number;
  pageSize: number;
}>;

export type Page<T> = Readonly<{
  items: readonly T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export type AdminPermissionDto = Readonly<{
  id: string;
  code: string;
  group: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdminRoleDto = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: readonly AdminPermissionDto[];
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdminUserRoleDto = Readonly<{
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  assignedAt: Date;
}>;

export type AdminUserListItemDto = Readonly<{
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
  mobile: string | null;
  status: UserStatus;
  roles: readonly AdminUserRoleDto[];
  branchId: string | null;
  isAdminActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdminUserDetailDto = AdminUserListItemDto &
  Readonly<{
    emailVerifiedAt: Date | null;
    profile: Readonly<{
      firstName: string | null;
      lastName: string | null;
    }> | null;
    addressCount: number;
    lastLoginAt: Date | null;
  }>;

export interface PublicJsonArray extends ReadonlyArray<PublicJsonValue> {}

export interface PublicJsonObject {
  readonly [key: string]: PublicJsonValue;
}

export type PublicJsonValue =
  | string
  | number
  | boolean
  | null
  | PublicJsonArray
  | PublicJsonObject;

export type AdminSettingDto = Readonly<{
  id: string;
  key: string;
  category: SettingCategory;
  value: PublicJsonValue | null;
  valueRedacted: boolean;
  isSensitive: boolean;
  version: number;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdminSettingVersionDto = Readonly<{
  id: string;
  version: number;
  value: PublicJsonValue | null;
  valueRedacted: boolean;
  changedById: string | null;
  createdAt: Date;
}>;

export type MediaMetadataDto = Readonly<{
  alt: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  pages: number | null;
}>;

export type AdminMediaDto = Readonly<{
  id: string;
  originalName: string;
  contentType: string;
  extension: string;
  bytes: number;
  kind: MediaKind;
  url: string | null;
  checksum: string | null;
  metadata: MediaMetadataDto | null;
  uploadedById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdminNotificationDto = Readonly<{
  id: string;
  recipientId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  category: string;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: PublicJsonValue | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdminAuditLogDto = Readonly<{
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: PublicJsonValue | null;
  createdAt: Date;
}>;

export type AdminDashboardStatusDto = Readonly<{
  generatedAt: Date;
  database: 'available';
  users: Readonly<{
    active: number;
    inactive: number;
    suspended: number;
  }>;
  roles: number;
  permissions: number;
  pendingNotifications: number;
  unreadNotifications: number;
  activeMedia: number;
  latestAuditAt: Date | null;
}>;
