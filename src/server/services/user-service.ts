import { NotFoundError } from '@/server/errors/app-error';
import { userRepository } from '@/server/repositories/user-repository';
export async function ownProfile(userId:string){const user=await userRepository.findById(userId);if(!user)throw new NotFoundError();return {id:user.id,email:user.email,mobile:user.mobile,status:user.status,profile:user.profile};}
