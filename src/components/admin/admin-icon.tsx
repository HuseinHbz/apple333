import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  ContactRound,
  FileClock,
  Image,
  Landmark,
  LayoutDashboard,
  Package,
  Settings2,
  ShieldCheck,
  UsersRound,
  type LucideProps
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { AdminNavIcon } from '@/modules/admin/navigation.config';

const icons = {
  dashboard: LayoutDashboard,
  users: UsersRound,
  shield: ShieldCheck,
  package: Package,
  boxes: Boxes,
  orders: ClipboardList,
  finance: Landmark,
  crm: ContactRound,
  reports: BarChart3,
  settings: Settings2,
  media: Image,
  notifications: Bell,
  audit: FileClock
} satisfies Record<AdminNavIcon, ComponentType<LucideProps>>;

export function AdminIcon({ name, ...props }: { name: AdminNavIcon } & LucideProps) {
  const Icon = icons[name];
  return <Icon aria-hidden="true" {...props} />;
}
