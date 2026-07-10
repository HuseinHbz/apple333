import { AuthenticationError } from '@/server/errors/app-error';
import type { SessionActor } from '@/server/security/permissions';
export const sessionCookie={name:'apple333.session',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
export async function currentActor():Promise<SessionActor|null>{return null;}
export async function requireActor():Promise<SessionActor>{const actor=await currentActor();if(!actor)throw new AuthenticationError();return actor;}
