import { describe,expect,it } from 'vitest';
import { GET } from '@/app/api/health/route';
describe('health route',()=>{it('returns an envelope and request id',async()=>{const response=await GET(new Request('http://localhost/api/health'));const body=await response.json() as {success:boolean;data:{status:string}};expect(response.status).toBe(200);expect(body).toEqual(expect.objectContaining({success:true,data:{status:'ok'}}));});});
