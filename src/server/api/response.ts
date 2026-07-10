import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '@/server/errors/app-error';
export type ApiMeta={requestId:string};
export function requestId(request:Request):string { return request.headers.get('x-request-id') ?? crypto.randomUUID(); }
export function success<T>(data:T, meta:ApiMeta, status=200){return NextResponse.json({success:true,data,meta},{status,headers:{'x-request-id':meta.requestId}});}
export function failure(error:unknown, meta:ApiMeta){const known=error instanceof ZodError?new ValidationError(Object.fromEntries(error.issues.map(i=>[i.path.join('.')||'root',i.message]))):error instanceof AppError?error:new AppError('INTERNAL_ERROR',500,'خطای غیرمنتظره رخ داد.');return NextResponse.json({success:false,error:{code:known.code,message:known.clientMessage,fields:known.metadata},meta},{status:known.status,headers:{'x-request-id':meta.requestId}});}
