import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminPageActor } from '@/modules/auth/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdminPageActor();

  return (
    <AdminShell
      actor={{
        id: actor.id,
        name: actor.name ?? null,
        email: actor.email ?? null,
        permissions: Array.from(actor.permissions)
      }}
    >
      {children}
    </AdminShell>
  );
}
