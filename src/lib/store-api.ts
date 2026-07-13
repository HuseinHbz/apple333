'use client';

export class StoreApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = 'StoreApiError';
    this.code = code;
  }
}

type ApiEnvelope<T> = Readonly<{
  success: boolean;
  data?: T;
  error?: Readonly<{ code?: string; message?: string }>;
}>;

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

export async function storeApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');

  if (init?.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new StoreApiError('پاسخ سرویس فروشگاه قابل خواندن نیست.');
  }

  if (!isEnvelope(payload)) {
    throw new StoreApiError('پاسخ سرویس فروشگاه نامعتبر است.');
  }

  if (!response.ok || !payload.success) {
    throw new StoreApiError(payload.error?.message ?? 'در ارتباط با فروشگاه خطایی رخ داد.', payload.error?.code ?? null);
  }

  return payload.data as T;
}
