import { AppError } from '@/server/errors/app-error';

export class ProtectedSystemRoleError extends AppError {
  constructor() {
    super(
      'SYSTEM_ROLE_PROTECTED',
      403,
      'نقش سیستمی قابل تغییر یا حذف نیست.',
    );
  }
}
