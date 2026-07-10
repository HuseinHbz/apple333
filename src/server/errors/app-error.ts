export class AppError extends Error { constructor(public readonly code:string, public readonly status:number, public readonly clientMessage:string, public readonly metadata?:Record<string,string>) { super(code); this.name='AppError'; } }
export class ValidationError extends AppError { constructor(fields:Record<string,string>) { super('VALIDATION_ERROR',400,'اطلاعات ارسالی معتبر نیست.',fields); } }
export class AuthenticationError extends AppError { constructor() { super('UNAUTHENTICATED',401,'ورود به حساب لازم است.'); } }
export class AuthorizationError extends AppError { constructor() { super('FORBIDDEN',403,'اجازهٔ انجام این عملیات را ندارید.'); } }
export class NotFoundError extends AppError { constructor() { super('NOT_FOUND',404,'منبع درخواستی یافت نشد.'); } }
export class ConflictError extends AppError { constructor() { super('CONFLICT',409,'این عملیات با وضعیت فعلی سازگار نیست.'); } }
export class RateLimitError extends AppError { constructor() { super('RATE_LIMITED',429,'تعداد درخواست‌ها بیش از حد مجاز است.'); } }
export class DatabaseError extends AppError { constructor() { super('DATABASE_UNAVAILABLE',503,'سرویس داده در دسترس نیست.'); } }
export class ExternalServiceError extends AppError { constructor() { super('EXTERNAL_SERVICE_UNAVAILABLE',503,'سرویس خارجی در دسترس نیست.'); } }
