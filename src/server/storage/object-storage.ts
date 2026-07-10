export interface ObjectStorage{put(input:{key:string;contentType:string;body:Uint8Array}):Promise<void>;signedReadUrl(key:string):Promise<string>}
export class UnconfiguredStorage implements ObjectStorage{async put():Promise<void>{throw new Error('STORAGE_NOT_CONFIGURED');}async signedReadUrl():Promise<string>{throw new Error('STORAGE_NOT_CONFIGURED');}}
