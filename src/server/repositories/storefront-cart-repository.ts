import type { Prisma } from '@prisma/client';

import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';

const cartMediaSelect = {
  mediaId: true,
  role: true,
  sortOrder: true,
  media: { select: { id: true, deletedAt: true } },
} satisfies Prisma.ProductMediaSelect;

const cartInventorySelect = {
  onHand: true,
  reserved: true,
  branch: { select: { id: true, name: true, city: true, isActive: true, isPickupEnabled: true } },
} satisfies Prisma.BranchInventorySelect;

export const storefrontCartSelect = {
  id: true,
  version: true,
  items: {
    orderBy: { createdAt: 'asc' },
    select: {
      quantity: true,
      variant: {
        select: {
          id: true,
          title: true,
          sku: true,
          priceRials: true,
          isActive: true,
          inventory: { select: cartInventorySelect },
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              status: true,
              media: { orderBy: { sortOrder: 'asc' }, select: cartMediaSelect },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.StorefrontCartSelect;

export type StorefrontCartRecord = Prisma.StorefrontCartGetPayload<{
  select: typeof storefrontCartSelect;
}>;

export const storefrontCartRepository = {
  findActiveByGuestTokenHash(
    guestTokenHash: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<StorefrontCartRecord | null> {
    return client.storefrontCart.findFirst({
      where: { guestTokenHash, status: 'ACTIVE' },
      select: storefrontCartSelect,
    });
  },

  createGuestCart(
    guestTokenHash: string,
    client: AdminDatabaseClient = prisma,
  ): Promise<StorefrontCartRecord> {
    return client.storefrontCart.create({
      data: { guestTokenHash, status: 'ACTIVE' },
      select: storefrontCartSelect,
    });
  },

  findVariantForCart(
    variantId: string,
    client: AdminDatabaseClient = prisma,
  ) {
    return client.catalogVariant.findFirst({
      where: { id: variantId, isActive: true, product: { is: { status: 'PUBLISHED' } } },
      select: { id: true, inventory: { select: cartInventorySelect } },
    });
  },

  countItems(cartId: string, client: AdminDatabaseClient = prisma) {
    return client.storefrontCartItem.count({ where: { cartId } });
  },

  findItem(cartId: string, variantId: string, client: AdminDatabaseClient = prisma) {
    return client.storefrontCartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
      select: { quantity: true },
    });
  },

  upsertItem(cartId: string, variantId: string, quantity: number, client: AdminDatabaseClient = prisma) {
    return client.storefrontCartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity },
      update: { quantity },
    });
  },

  deleteItem(cartId: string, variantId: string, client: AdminDatabaseClient = prisma) {
    return client.storefrontCartItem.deleteMany({ where: { cartId, variantId } });
  },

  touch(cartId: string, client: AdminDatabaseClient = prisma) {
    return client.storefrontCart.update({
      where: { id: cartId },
      data: { version: { increment: 1 } },
      select: storefrontCartSelect,
    });
  },
};
