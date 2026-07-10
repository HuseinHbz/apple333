export interface Cache{get(key:string):Promise<string|null>;set(key:string,value:string,ttlSeconds:number):Promise<void>;ping():Promise<boolean>}
export class DisabledCache implements Cache{async get():Promise<null>{return null;}async set():Promise<void>{}async ping():Promise<boolean>{return false;}}
export const cache:Cache=new DisabledCache();
