import { requireActor } from '@/modules/auth/session';
import { failure, requestId, success } from '@/server/api/response';
import { noStore } from '@/server/security/request-security';
import { ownProfile } from '@/server/services/user-service';

export async function GET(request: Request) {
  const meta = { requestId: requestId(request) };

  try {
    const actor = await requireActor();
    return noStore(success(await ownProfile(actor.id), meta));
  } catch (error) {
    return noStore(failure(error, meta));
  }
}
