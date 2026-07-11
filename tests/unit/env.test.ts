import { describe,expect,it } from 'vitest';
import { readServerEnv } from '@/config/env';
describe('environment validation',()=>{it('rejects an invalid server configuration',()=>expect(()=>readServerEnv({APP_URL:'nope'})).toThrow());it('accepts required development values',()=>expect(readServerEnv({NODE_ENV:'test',APP_NAME:'Apple333',APP_URL:'http://localhost:3000',DATABASE_URL:'postgresql://user:pass@localhost:5432/db',AUTH_SECRET:'a'.repeat(32),AUTH_URL:'http://localhost:3000'}).APP_NAME).toBe('Apple333'));});
