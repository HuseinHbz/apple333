export type PublicCategoryDto = Readonly<{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
}>;

export type ProductAvailability = 'IN_STOCK' | 'OUT_OF_STOCK';
export type BranchAvailability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE';

export type PublicProductCardDto = Readonly<{
  id: string;
  slug: string;
  name: string;
  brand: string;
  summary: string | null;
  category: Pick<PublicCategoryDto, 'slug' | 'name'> | null;
  heroMediaUrl: string | null;
  startingPriceRials: string;
  compareAtPriceRials: string | null;
  availability: ProductAvailability;
  isNew: boolean;
  isOnSale: boolean;
}>;

export type PublicProductVariantDto = Readonly<{
  id: string;
  sku: string;
  title: string | null;
  color: string | null;
  storage: string | null;
  region: string | null;
  warranty: string | null;
  priceRials: string;
  compareAtPriceRials: string | null;
  availability: ProductAvailability;
  branches: readonly Readonly<{ id: string; name: string; city: string | null; available: number; availability: BranchAvailability }>[];
}>;

export type PublicProductSeoDto = Readonly<{
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
}>;

export type PublicProductDto = PublicProductCardDto & Readonly<{
  description: string | null;
  specifications: readonly Readonly<{ key: string; value: string }>[];
  media: readonly Readonly<{ id: string; role: 'HERO' | 'GALLERY' | 'VIDEO'; altText: string | null; url: string }>[];
  variants: readonly PublicProductVariantDto[];
  seo: PublicProductSeoDto;
}>;

export type StorefrontCartItemDto = Readonly<{
  variantId: string;
  quantity: number;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  unitPriceRials: string;
  availability: ProductAvailability;
  heroMediaUrl: string | null;
  branches: readonly Readonly<{ id: string; name: string; city: string | null; available: number }>[];
}>;

export type StorefrontCartDto = Readonly<{
  itemCount: number;
  subtotalRials: string;
  items: readonly StorefrontCartItemDto[];
}>;

export type StorefrontQuoteDto = Readonly<{
  cart: StorefrontCartDto;
  fulfillment: 'PICKUP' | 'DELIVERY';
  pickupBranch: Readonly<{ id: string; name: string; city: string | null }> | null;
  shippingRials: null;
  insuranceRials: null;
  installmentAvailable: false;
  walletAvailable: false;
  canProceedToPayment: false;
  nextStep: 'PHASE_04_ORDER_AND_PAYMENT_REQUIRED';
}>;
