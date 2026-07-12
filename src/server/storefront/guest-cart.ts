import { createHash, randomBytes } from 'node:crypto';

export const GUEST_CART_COOKIE = 'apple333_store_cart';

export type GuestCartIdentity = Readonly<{
  token: string;
  tokenHash: string;
  isNew: boolean;
}>;

export function guestCartToken(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${GUEST_CART_COOKIE}=`));
  const value = match?.slice(GUEST_CART_COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{32,128}$/.test(value) ? value : undefined;
}

export function newGuestCartToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashGuestCartToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function resolveGuestCartIdentity(request: Request): GuestCartIdentity {
  const existing = guestCartToken(request);
  const token = existing ?? newGuestCartToken();
  return { token, tokenHash: hashGuestCartToken(token), isNew: existing === undefined };
}

export function guestCartCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${GUEST_CART_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

export function attachGuestCartCookie(response: Response, identity: GuestCartIdentity): Response {
  if (identity.isNew) response.headers.append('Set-Cookie', guestCartCookie(identity.token));
  return response;
}
