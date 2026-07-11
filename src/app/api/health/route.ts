import { requestId, success } from '@/server/api/response';
export async function GET(request:Request){const meta={requestId:requestId(request)};return success({status:'ok'},meta);}
