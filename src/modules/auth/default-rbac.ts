import { PERMISSIONS, type Permission } from '@/server/security/permissions';

export type SystemRoleDefinition = {
  code: string;
  name: string;
  description: string;
  permissions: readonly Permission[];
};

const allPermissions = [...PERMISSIONS] as const;

export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full platform administration.', permissions: allPermissions },
  { code: 'ADMIN', name: 'Administrator', description: 'Operational administration across all modules.', permissions: allPermissions },
  { code: 'BUSINESS_OWNER', name: 'Business Owner', description: 'Executive visibility and business governance.', permissions: ['dashboard.read', 'users.read', 'roles.read', 'permissions.read', 'settings.read', 'audit.read', 'reports.read'] },
  { code: 'BRANCH_MANAGER', name: 'Branch Manager', description: 'Branch-scoped operations.', permissions: ['dashboard.read', 'users.read', 'products.read', 'inventory.read', 'orders.read', 'crm.read', 'reports.read'] },
  { code: 'SALES_STAFF', name: 'Sales Staff', description: 'Sales and CRM operations.', permissions: ['dashboard.read', 'products.read', 'orders.read', 'crm.read'] },
  { code: 'WAREHOUSE_STAFF', name: 'Warehouse Staff', description: 'Inventory operations.', permissions: ['dashboard.read', 'products.read', 'inventory.read'] },
  { code: 'FINANCE_STAFF', name: 'Finance Staff', description: 'Finance and order review.', permissions: ['dashboard.read', 'orders.read', 'finance.read', 'reports.read'] },
  { code: 'SUPPORT_STAFF', name: 'Support Staff', description: 'Customer support and notification handling.', permissions: ['dashboard.read', 'users.read', 'crm.read', 'notifications.read', 'notifications.update'] },
  { code: 'CUSTOMER', name: 'Customer', description: 'Customer account role; it does not grant admin access.', permissions: [] }
];

export const permissionDefinitions = PERMISSIONS.map((code) => ({
  code,
  group: code.split('.')[0] ?? 'system',
  description: `${code} permission`
}));
