'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string };
};

type RoleOption = { id: string; code: string; name: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  const envelope = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !envelope.success || envelope.data === undefined) {
    throw new Error(envelope.error?.code ?? 'ADMIN_MUTATION_FAILED');
  }
  return envelope.data;
}

export function AdminUserActions({
  userId,
  status,
  canManage,
  canAssignRole = false,
}: {
  userId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  canManage: boolean;
  canAssignRole?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [roleId, setRoleId] = useState('');
  const roles = useQuery({
    queryKey: ['admin', 'roles', 'assignment-options'],
    queryFn: () => request<readonly RoleOption[]>('/api/admin/roles'),
    enabled: canAssignRole,
    staleTime: 60_000
  });
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] });
    router.refresh();
  };
  const statusMutation = useMutation({
    mutationFn: (nextStatus: 'ACTIVE' | 'INACTIVE') => request(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    }),
    onSuccess: invalidate
  });
  const roleMutation = useMutation({
    mutationFn: () => request(`/api/admin/users/${userId}/roles`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roleId })
    }),
    onSuccess: invalidate
  });

  if (!canManage && !canAssignRole) {
    return null;
  }

  const busy = statusMutation.isPending || roleMutation.isPending;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage ? <><Button disabled={busy || status === 'ACTIVE'} onClick={() => statusMutation.mutate('ACTIVE')} size="sm" variant="secondary">فعال‌سازی</Button><Button disabled={busy || status !== 'ACTIVE'} onClick={() => statusMutation.mutate('INACTIVE')} size="sm" variant="danger">غیرفعال‌سازی</Button></> : null}
      {canAssignRole ? <><select aria-label="نقش جدید" className="h-8 max-w-36 rounded-lg border border-zinc-200 bg-white px-2 text-xs" onChange={(event) => setRoleId(event.target.value)} value={roleId}>
        <option value="">انتخاب نقش</option>
        {roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select><Button disabled={busy || !roleId} onClick={() => roleMutation.mutate()} size="sm" variant="secondary">تخصیص نقش</Button></> : null}
    </div>
  );
}
