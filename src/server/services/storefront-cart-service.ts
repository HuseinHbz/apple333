import { Prisma } from '@prisma/client';

import type { AddCartItemInput, CheckoutQuoteInput, UpdateCartItemInput } from '@/modules/cart/validators';
import type {
  ProductAvailability,
  StorefrontCartDto,
  StorefrontCartItemDto,
  StorefrontQuoteDto,
} from '@/modules/catalog/types';
import type { AdminDatabaseClient } from '@/server/admin/database';
import { prisma } from '@/server/db/prisma';
import { ConflictError, NotFoundError } from '@/server/errors/app-error';
import {
  storefrontCartRepository,
  type StorefrontCartRecord,
} from '@/server/repositories/storefront-cart-repository';

const MAX_CART_LINES = 20;

type InventoryEntry = StorefrontCartRecord['items'][number]['variant']['inventory'][number];

function available(entry: InventoryEntry): number {
  return entry.branch.isActive ? Math.max(entry.onHand - entry.reserved, 0) : 0;
}

function availability(entries: readonly InventoryEntry[]): ProductAvailability {
  return entries.some((entry) => available(entry) > 0) ? 'IN_STOCK' : 'OUT_OF_STOCK';
}

function heroMediaUrl(productId: string, media: StorefrontCartRecord['items'][number]['variant']['product']['media']): string | null {
  const selected = media.find((entry) => entry.media.deletedAt === null && entry.role === 'HERO')
    ?? media.find((entry) => entry.media.deletedAt === null);
  return selected ? `/api/store/media/${encodeURIComponent(productId)}/${encodeURIComponent(selected.mediaId)}` : null;
}

function asCartItem(item: StorefrontCartRecord['items'][number]): StorefrontCartItemDto {
  const { variant } = item;
  return {
    variantId: variant.id,
    quantity: item.quantity,
    productSlug: variant.product.slug,
    productName: variant.product.name,
    variantLabel: variant.title,
    unitPriceRials: variant.priceRials.toString(),
    availability: availability(variant.inventory),
    heroMediaUrl: heroMediaUrl(variant.product.id, variant.product.media),
    branches: variant.inventory
      .filter((entry) => entry.branch.isActive && entry.branch.isPickupEnabled)
      .map((entry) => ({
        id: entry.branch.id,
        name: entry.branch.name,
        city: entry.branch.city,
        available: available(entry),
      })),
  };
}

export function toStorefrontCartDto(cart: StorefrontCartRecord): StorefrontCartDto {
  const items = cart.items.map(asCartItem);
  const subtotal = cart.items.reduce(
    (total, item) => total + (item.variant.priceRials * BigInt(item.quantity)),
    0n,
  );
  return { itemCount: items.reduce((total, item) => total + item.quantity, 0), subtotalRials: subtotal.toString(), items };
}

function availableForVariant(inventory: readonly InventoryEntry[]): number {
  return inventory.reduce((total, entry) => total + available(entry), 0);
}

function assertPurchasable(variant: Awaited<ReturnType<typeof storefrontCartRepository.findVariantForCart>>): asserts variant is NonNullable<typeof variant> {
  if (!variant || availableForVariant(variant.inventory) < 1) throw new ConflictError();
}

async function findOrCreateGuestCart(
  guestTokenHash: string,
  client: AdminDatabaseClient,
): Promise<StorefrontCartRecord> {
  const existing = await storefrontCartRepository.findActiveByGuestTokenHash(guestTokenHash, client);
  if (existing) return existing;

  try {
    return await storefrontCartRepository.createGuestCart(guestTokenHash, client);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrentCart = await storefrontCartRepository.findActiveByGuestTokenHash(guestTokenHash, client);
      if (concurrentCart) return concurrentCart;
    }
    throw error;
  }
}

async function mutateGuestCart(
  guestTokenHash: string,
  mutation: (cart: StorefrontCartRecord, client: Prisma.TransactionClient) => Promise<StorefrontCartRecord>,
): Promise<StorefrontCartDto> {
  const cart = await prisma.$transaction(async (transaction) => {
    const activeCart = await findOrCreateGuestCart(guestTokenHash, transaction);
    return mutation(activeCart, transaction);
  });
  return toStorefrontCartDto(cart);
}

export async function getGuestCart(guestTokenHash: string): Promise<StorefrontCartDto> {
  const cart = await findOrCreateGuestCart(guestTokenHash, prisma);
  return toStorefrontCartDto(cart);
}

export async function addGuestCartItem(
  guestTokenHash: string,
  input: AddCartItemInput,
): Promise<StorefrontCartDto> {
  return mutateGuestCart(guestTokenHash, async (cart, transaction) => {
    const variant = await storefrontCartRepository.findVariantForCart(input.variantId, transaction);
    assertPurchasable(variant);
    const existing = await storefrontCartRepository.findItem(cart.id, input.variantId, transaction);
    if (!existing && await storefrontCartRepository.countItems(cart.id, transaction) >= MAX_CART_LINES) throw new ConflictError();

    const requestedQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (requestedQuantity > 10 || requestedQuantity > availableForVariant(variant.inventory)) throw new ConflictError();

    await storefrontCartRepository.upsertItem(cart.id, input.variantId, requestedQuantity, transaction);
    return storefrontCartRepository.touch(cart.id, transaction);
  });
}

export async function updateGuestCartItem(
  guestTokenHash: string,
  variantId: string,
  input: UpdateCartItemInput,
): Promise<StorefrontCartDto> {
  return mutateGuestCart(guestTokenHash, async (cart, transaction) => {
    const item = await storefrontCartRepository.findItem(cart.id, variantId, transaction);
    if (!item) throw new NotFoundError();

    if (input.quantity === 0) {
      await storefrontCartRepository.deleteItem(cart.id, variantId, transaction);
      return storefrontCartRepository.touch(cart.id, transaction);
    }

    const variant = await storefrontCartRepository.findVariantForCart(variantId, transaction);
    assertPurchasable(variant);
    if (input.quantity > availableForVariant(variant.inventory)) throw new ConflictError();
    await storefrontCartRepository.upsertItem(cart.id, variantId, input.quantity, transaction);
    return storefrontCartRepository.touch(cart.id, transaction);
  });
}

export async function removeGuestCartItem(guestTokenHash: string, variantId: string): Promise<StorefrontCartDto> {
  return mutateGuestCart(guestTokenHash, async (cart, transaction) => {
    const item = await storefrontCartRepository.findItem(cart.id, variantId, transaction);
    if (!item) throw new NotFoundError();
    await storefrontCartRepository.deleteItem(cart.id, variantId, transaction);
    return storefrontCartRepository.touch(cart.id, transaction);
  });
}

function pickupBranchFor(
  cart: StorefrontCartRecord,
  branchId: string,
): StorefrontQuoteDto['pickupBranch'] {
  const firstMatch = cart.items[0]?.variant.inventory.find(
    (entry) => entry.branch.id === branchId && entry.branch.isActive && entry.branch.isPickupEnabled && available(entry) > 0,
  );
  if (!firstMatch) return null;

  const fulfillsEveryItem = cart.items.every((item) => item.variant.inventory.some(
    (entry) => entry.branch.id === branchId && entry.branch.isActive && entry.branch.isPickupEnabled && available(entry) >= item.quantity,
  ));
  return fulfillsEveryItem
    ? { id: firstMatch.branch.id, name: firstMatch.branch.name, city: firstMatch.branch.city }
    : null;
}

export async function quoteGuestCart(
  guestTokenHash: string,
  input: CheckoutQuoteInput,
): Promise<StorefrontQuoteDto> {
  const cart = await findOrCreateGuestCart(guestTokenHash, prisma);
  if (cart.items.length === 0) throw new ConflictError();
  if (cart.items.some((item) => !item.variant.isActive || item.variant.product.status !== 'PUBLISHED' || availableForVariant(item.variant.inventory) < item.quantity)) {
    throw new ConflictError();
  }

  const pickupBranch = input.fulfillment === 'PICKUP' && input.pickupBranchId
    ? pickupBranchFor(cart, input.pickupBranchId)
    : null;
  if (input.fulfillment === 'PICKUP' && !pickupBranch) throw new ConflictError();

  return {
    cart: toStorefrontCartDto(cart),
    fulfillment: input.fulfillment,
    pickupBranch,
    shippingRials: null,
    insuranceRials: null,
    installmentAvailable: false,
    walletAvailable: false,
    canProceedToPayment: false,
    nextStep: 'PHASE_04_ORDER_AND_PAYMENT_REQUIRED',
  };
}
