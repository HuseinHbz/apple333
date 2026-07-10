import { prisma } from '@/server/db/prisma';
export const userRepository={findById:(id:string)=>prisma.user.findUnique({where:{id},include:{profile:true}}),list:(skip:number,take:number)=>prisma.user.findMany({skip,take,orderBy:{createdAt:'desc'},select:{id:true,email:true,mobile:true,status:true,createdAt:true}})};
