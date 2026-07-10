import { AuthorizationError } from '@/server/errors/app-error';
export const PERMISSIONS=['users.read','users.create','users.update','users.delete','roles.manage','settings.read','settings.update','audit.read'] as const;
export type Permission=typeof PERMISSIONS[number];
export type SessionActor={id:string;permissions:ReadonlySet<Permission>;branchId?:string};
export function requirePermission(actor:SessionActor,permission:Permission){if(!actor.permissions.has(permission)) throw new AuthorizationError();}
