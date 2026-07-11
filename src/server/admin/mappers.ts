import type {
  MediaKind,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  SettingCategory,
  UserStatus,
} from '@prisma/client';

import type {
  AdminAuditLogDto,
  AdminMediaDto,
  AdminNotificationDto,
  AdminPermissionDto,
  AdminRoleDto,
  AdminSettingDto,
  AdminSettingVersionDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserRoleDto,
  MediaMetadataDto,
  PublicJsonValue,
} from './types';

const sensitiveJsonKey = /(?:password|passcode|secret|token|authorization|cookie|national.?code)/i;

function sanitizeJson(value: unknown): PublicJsonValue | null {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJson(entry));
  }

  if (typeof value !== 'object') {
    return null;
  }

  const output: Record<string, PublicJsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!sensitiveJsonKey.test(key)) {
      output[key] = sanitizeJson(entry);
    }
  }

  return output;
}

export function toPermissionDto(permission: {
  id: string;
  code: string;
  group: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminPermissionDto {
  return permission;
}

export function toRoleDto(role: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: readonly {
    permission: {
      id: string;
      code: string;
      group: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
}): AdminRoleDto {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions.map(({ permission }) => toPermissionDto(permission)),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

function toUserRoleDto(userRole: {
  assignedAt: Date;
  role: {
    id: string;
    code: string;
    name: string;
    isSystem: boolean;
  };
}): AdminUserRoleDto {
  return {
    ...userRole.role,
    assignedAt: userRole.assignedAt,
  };
}

type AdminUserRecord = {
  id: string;
  name: string | null;
  image: string | null;
  email: string | null;
  mobile: string | null;
  status: UserStatus;
  roles: readonly {
    assignedAt: Date;
    role: {
      id: string;
      code: string;
      name: string;
      isSystem: boolean;
    };
  }[];
  adminProfile: {
    branchId: string | null;
    isActive: boolean;
    lastLoginAt: Date | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toAdminUserListItemDto(
  user: AdminUserRecord,
): AdminUserListItemDto {
  return {
    id: user.id,
    name: user.name,
    image: user.image,
    email: user.email,
    mobile: user.mobile,
    status: user.status,
    roles: user.roles.map(toUserRoleDto),
    branchId: user.adminProfile?.branchId ?? null,
    isAdminActive: user.adminProfile?.isActive ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toAdminUserDetailDto(
  user: AdminUserRecord & {
    emailVerified: Date | null;
    profile: {
      firstName: string | null;
      lastName: string | null;
    } | null;
    _count: { addresses: number };
  },
): AdminUserDetailDto {
  return {
    ...toAdminUserListItemDto(user),
    emailVerifiedAt: user.emailVerified,
    profile: user.profile,
    addressCount: user._count.addresses,
    lastLoginAt: user.adminProfile?.lastLoginAt ?? null,
  };
}

export function toSettingDto(setting: {
  id: string;
  key: string;
  category: SettingCategory;
  value: unknown;
  isSensitive: boolean;
  version: number;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminSettingDto {
  return {
    id: setting.id,
    key: setting.key,
    category: setting.category,
    value: setting.isSensitive ? null : sanitizeJson(setting.value),
    valueRedacted: setting.isSensitive,
    isSensitive: setting.isSensitive,
    version: setting.version,
    updatedById: setting.updatedById,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
}

export function toSettingVersionDto(
  version: {
    id: string;
    version: number;
    value: unknown;
    changedById: string | null;
    createdAt: Date;
  },
  isSensitive: boolean,
): AdminSettingVersionDto {
  return {
    id: version.id,
    version: version.version,
    value: isSensitive ? null : sanitizeJson(version.value),
    valueRedacted: isSensitive,
    changedById: version.changedById,
    createdAt: version.createdAt,
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function toMediaMetadataDto(value: unknown): MediaMetadataDto | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const metadata = value as Record<string, unknown>;

  return {
    alt: nullableString(metadata.alt),
    width: nullableNonNegativeInteger(metadata.width),
    height: nullableNonNegativeInteger(metadata.height),
    durationSeconds: nullableNonNegativeInteger(metadata.durationSeconds),
    pages: nullableNonNegativeInteger(metadata.pages),
  };
}

export function toMediaDto(media: {
  id: string;
  originalName: string;
  contentType: string;
  extension: string;
  bytes: number;
  kind: MediaKind;
  url: string | null;
  checksum: string | null;
  metadata: unknown;
  uploadedById: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminMediaDto {
  return {
    id: media.id,
    originalName: media.originalName,
    contentType: media.contentType,
    extension: media.extension,
    bytes: media.bytes,
    kind: media.kind,
    url: media.url,
    checksum: media.checksum,
    metadata: toMediaMetadataDto(media.metadata),
    uploadedById: media.uploadedById,
    deletedAt: media.deletedAt,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

export function toNotificationDto(notification: {
  id: string;
  recipientId: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  category: string;
  title: string;
  body: string;
  actionUrl: string | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AdminNotificationDto {
  return {
    id: notification.id,
    recipientId: notification.recipientId,
    channel: notification.channel,
    priority: notification.priority,
    status: notification.status,
    category: notification.category,
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    metadata: sanitizeJson(notification.metadata),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

export function toAuditLogDto(log: {
  id: string;
  actorId: string | null;
  actor: { name: string | null; email: string | null; mobile: string | null } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}): AdminAuditLogDto {
  return {
    id: log.id,
    actorId: log.actorId,
    actorName: log.actor?.name ?? log.actor?.email ?? log.actor?.mobile ?? null,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    requestId: log.requestId,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent,
    metadata: sanitizeJson(log.metadata),
    createdAt: log.createdAt,
  };
}
