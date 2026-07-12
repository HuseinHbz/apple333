import { z } from 'zod';

const cuid = z.string().cuid();

export const addCartItemInput = z.object({
  variantId: cuid,
  quantity: z.number().int().min(1).max(10).default(1),
});

export const updateCartItemInput = z.object({
  quantity: z.number().int().min(0).max(10),
});

export const cartVariantInput = z.object({ variantId: cuid });

export const checkoutQuoteInput = z.object({
  fulfillment: z.enum(['PICKUP', 'DELIVERY']),
  pickupBranchId: cuid.optional(),
  wantsInsurance: z.boolean().optional(),
  paymentMethod: z.enum(['ONLINE', 'INSTALLMENT', 'WALLET']).optional(),
}).superRefine((value, context) => {
  if (value.fulfillment === 'PICKUP' && value.pickupBranchId === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pickupBranchId'], message: 'برای تحویل حضوری انتخاب شعبه لازم است.' });
  }
  if (value.fulfillment === 'DELIVERY' && value.pickupBranchId !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['pickupBranchId'], message: 'شعبه فقط برای تحویل حضوری قابل انتخاب است.' });
  }
});

export type AddCartItemInput = z.output<typeof addCartItemInput>;
export type UpdateCartItemInput = z.output<typeof updateCartItemInput>;
export type CartVariantInput = z.output<typeof cartVariantInput>;
export type CheckoutQuoteInput = z.output<typeof checkoutQuoteInput>;
