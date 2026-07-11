import { requestId, success } from '@/server/api/response';
import { readiness } from '@/server/services/readiness';
export async function GET(request:Request){const meta={requestId:requestId(request)};const status=await readiness();return success(status,meta,status.ready?200:503);}
