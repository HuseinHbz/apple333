import { describe, expect, it } from 'vitest';

import {
  addCartItemInput,
  checkoutQuoteInput,
  updateCartItemInput,
} from '@/modules/cart/validators';
import {
  catalogPageQuery,
  compareSlugsQuery,
  productSlugInput,
} from '@/modules/catalog/validators';

const VARIANT_ID = 'ckz8x8x8x000001l4h3e5f6g7';
const BRANCH_ID = 'cm1a2b3c4d5e6f7g8h9i0j1k2';

describe('storefront validators', () => {
  it('normalizes bounded catalog filters and applies safe defaults', () => {
    const query = catalogPageQuery.parse({
      page: '2',
      pageSize: '24',
      category: 'IPhone-16-Pro',
      minPriceRials: '1000000',
      maxPriceRials: '2000000',
      sort: 'price-asc',
      collection: 'sale',
      inStock: 'false',
    });

    expect(query).toMatchObject({
      page: 2,
      pageSize: 24,
      category: 'iphone-16-pro',
      minPriceRials: 1_000_000n,
      maxPriceRials: 2_000_000n,
      sort: 'price-asc',
      collection: 'sale',
      inStock: false,
    });
  });

  it('rejects malformed product slugs and invalid catalog price ranges', () => {
    expect(() => productSlugInput.parse({ slug: '../iphone-16' })).toThrow();
    expect(() => catalogPageQuery.parse({ minPriceRials: '200', maxPriceRials: '100' })).toThrow();
    expect(() => catalogPageQuery.parse({ inStock: 'not-a-boolean' })).toThrow();
  });

  it('limits comparison to two through four unique, valid product slugs', () => {
    expect(compareSlugsQuery.parse({
      slugs: 'iphone-16-pro, iphone-16, airpods-pro-2',
    }).slugs).toEqual(['iphone-16-pro', 'iphone-16', 'airpods-pro-2']);

    expect(() => compareSlugsQuery.parse({ slugs: 'iphone-16' })).toThrow();
    expect(() => compareSlugsQuery.parse({ slugs: 'iphone-16,../ipad' })).toThrow();
  });

  it('enforces cart quantities and validated variant identifiers', () => {
    expect(addCartItemInput.parse({ variantId: VARIANT_ID })).toEqual({
      variantId: VARIANT_ID,
      quantity: 1,
    });
    expect(updateCartItemInput.parse({ quantity: 0 })).toEqual({ quantity: 0 });

    expect(() => addCartItemInput.parse({ variantId: 'not-a-cuid', quantity: 1 })).toThrow();
    expect(() => addCartItemInput.parse({ variantId: VARIANT_ID, quantity: 11 })).toThrow();
  });

  it('keeps pickup and delivery quote inputs mutually exclusive', () => {
    expect(checkoutQuoteInput.parse({
      fulfillment: 'PICKUP',
      pickupBranchId: BRANCH_ID,
      wantsInsurance: true,
      paymentMethod: 'INSTALLMENT',
    })).toMatchObject({ fulfillment: 'PICKUP', pickupBranchId: BRANCH_ID });

    expect(checkoutQuoteInput.parse({ fulfillment: 'DELIVERY', paymentMethod: 'ONLINE' }))
      .toMatchObject({ fulfillment: 'DELIVERY', paymentMethod: 'ONLINE' });

    expect(() => checkoutQuoteInput.parse({ fulfillment: 'PICKUP' })).toThrow();
    expect(() => checkoutQuoteInput.parse({ fulfillment: 'DELIVERY', pickupBranchId: BRANCH_ID })).toThrow();
  });
});
