import { failure, requestId, success } from '@/server/api/response';
import { requireActor } from '@/modules/auth/session';
import { ownProfile } from '@/server/services/user-service';
export async function GET(request:Request){const meta={requestId:requestId(request)};try{const actor=await requireActor();return success(await ownProfile(actor.id),meta);}catch(error){return failure(error,meta);}}
