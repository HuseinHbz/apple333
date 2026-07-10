import { z } from 'zod';
export const iranMobile=z.string().regex(/^09\d{9}$/,'شماره همراه معتبر نیست.');
export const addressInput=z.object({label:z.string().trim().max(50).optional(),recipientName:z.string().trim().min(2).max(120),mobile:iranMobile,line1:z.string().trim().min(5).max(500),province:z.string().trim().max(80).optional(),city:z.string().trim().max(80).optional(),postalCode:z.string().regex(/^\d{10}$/).optional()});
export type AddressInput=z.infer<typeof addressInput>;
