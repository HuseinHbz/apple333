import { describe,expect,it } from 'vitest';
import { AuthorizationError } from '@/server/errors/app-error';
import { requirePermission } from '@/server/security/permissions';
describe('permission guard',()=>{it('rejects a missing permission',()=>expect(()=>requirePermission({id:'u1',permissions:new Set()},'users.read')).toThrow(AuthorizationError));});
