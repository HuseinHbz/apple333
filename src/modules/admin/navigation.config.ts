export type AdminNavIcon =
  | 'dashboard'
  | 'users'
  | 'shield'
  | 'package'
  | 'boxes'
  | 'orders'
  | 'finance'
  | 'crm'
  | 'reports'
  | 'settings'
  | 'media'
  | 'notifications'
  | 'audit';

export interface AdminNavigationItem {
  id: string;
  label: string;
  href: string;
  icon: AdminNavIcon;
  permission?: string;
  availability: 'available' | 'planned';
}

export interface AdminNavigationGroup {
  id: string;
  label: string;
  items: readonly AdminNavigationItem[];
}

export const adminNavigation: readonly AdminNavigationGroup[] = [
  {
    id: 'overview',
    label: 'نمای کلی',
    items: [{ id: 'dashboard', label: 'داشبورد', href: '/admin', icon: 'dashboard', permission: 'dashboard.read', availability: 'available' }]
  },
  {
    id: 'access',
    label: 'دسترسی و کاربران',
    items: [
      { id: 'users', label: 'کاربران', href: '/admin/users', icon: 'users', permission: 'users.read', availability: 'available' },
      { id: 'roles', label: 'نقش‌ها', href: '/admin/roles', icon: 'shield', permission: 'roles.read', availability: 'available' },
      { id: 'permissions', label: 'مجوزها', href: '/admin/permissions', icon: 'shield', permission: 'permissions.read', availability: 'available' }
    ]
  },
  {
    id: 'commerce',
    label: 'عملیات تجاری',
    items: [
      { id: 'products', label: 'محصولات', href: '/admin/products', icon: 'package', permission: 'products.read', availability: 'planned' },
      { id: 'inventory', label: 'موجودی', href: '/admin/inventory', icon: 'boxes', permission: 'inventory.read', availability: 'planned' },
      { id: 'orders', label: 'سفارش‌ها', href: '/admin/orders', icon: 'orders', permission: 'orders.read', availability: 'planned' },
      { id: 'finance', label: 'مالی', href: '/admin/finance', icon: 'finance', permission: 'finance.read', availability: 'planned' },
      { id: 'crm', label: 'مشتریان', href: '/admin/crm', icon: 'crm', permission: 'crm.read', availability: 'planned' },
      { id: 'reports', label: 'گزارش‌ها', href: '/admin/reports', icon: 'reports', permission: 'reports.read', availability: 'planned' }
    ]
  },
  {
    id: 'system',
    label: 'سیستم',
    items: [
      { id: 'settings', label: 'تنظیمات', href: '/admin/settings', icon: 'settings', permission: 'settings.read', availability: 'available' },
      { id: 'media', label: 'رسانه‌ها', href: '/admin/media', icon: 'media', permission: 'media.read', availability: 'available' },
      { id: 'notifications', label: 'اعلان‌ها', href: '/admin/notifications', icon: 'notifications', permission: 'notifications.read', availability: 'available' },
      { id: 'audit-logs', label: 'رویدادهای ممیزی', href: '/admin/audit-logs', icon: 'audit', permission: 'audit.read', availability: 'available' }
    ]
  }
];

export function visibleAdminNavigation(permissions: ReadonlySet<string>): readonly AdminNavigationGroup[] {
  return adminNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || permissions.has(item.permission))
    }))
    .filter((group) => group.items.length > 0);
}

export function findAdminNavigationItem(pathname: string): AdminNavigationItem | undefined {
  const items = adminNavigation.flatMap((group) => group.items);
  return items.find((item) => item.href === pathname)
    ?? items.find((item) => item.href !== '/admin' && pathname.startsWith(`${item.href}/`));
}
