import { NotFoundError } from '@/server/errors/app-error';
import { userRepository } from '@/server/repositories/user-repository';

export async function ownProfile(userId: string) {
  const user = await userRepository.findSafeProfileById(userId);
  if (!user) {
    throw new NotFoundError();
  }

  return user;
}
