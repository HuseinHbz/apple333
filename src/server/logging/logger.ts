export type LogContext={requestId:string;route?:string;method?:string;userId?:string;durationMs?:number;errorCode?:string};
const hidden=new Set(['authorization','cookie','password','otp','token','nationalCode','cardNumber']);
export function log(level:'info'|'warn'|'error',message:string,context:LogContext){const safe=Object.fromEntries(Object.entries(context).filter(([key])=>!hidden.has(key.toLowerCase())));console[level](JSON.stringify({timestamp:new Date().toISOString(),level,message,...safe}));}
