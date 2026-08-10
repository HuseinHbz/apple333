import type { Metadata } from 'next';

import type { PublicProductDto } from '@/modules/catalog/types';

const DEFAULT_TITLE = 'Apple333 | فروشگاه تخصصی محصولات اپل';
const DEFAULT_DESCRIPTION = 'مشاهده و مقایسهٔ محصولات اپل با مشخصات، قیمت و موجودی شفاف شعب Apple333.';

function configuredOrigin(): URL {
  const fallback = 'http://localhost:3000';
  const configured = process.env.APP_URL?.trim() || fallback;

  try {
    return new URL(configured);
  } catch {
    return new URL(fallback);
  }
}

export function storefrontUrl(pathname = '/'): string {
  return new URL(pathname, configuredOrigin()).toString();
}

function trustedCanonical(candidate: string | null, fallbackPath: string): string {
  if (!candidate) return storefrontUrl(fallbackPath);

  try {
    const parsed = new URL(candidate);
    return parsed.origin === configuredOrigin().origin ? parsed.toString() : storefrontUrl(fallbackPath);
  } catch {
    return storefrontUrl(fallbackPath);
  }
}

export function storefrontMetadata(): Metadata {
  return {
    metadataBase: configuredOrigin(),
    title: { default: DEFAULT_TITLE, template: '%s | Apple333' },
    description: DEFAULT_DESCRIPTION,
    alternates: { canonical: storefrontUrl('/') },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: 'Apple333',
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: storefrontUrl('/'),
    },
    twitter: { card: 'summary_large_image', title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION },
  };
}

export function productMetadata(product: PublicProductDto): Metadata {
  const fallbackPath = `/products/${encodeURIComponent(product.slug)}`;
  const title = product.seo.metaTitle ?? product.name;
  const description = product.seo.metaDescription ?? product.summary ?? product.description ?? DEFAULT_DESCRIPTION;
  const canonical = trustedCanonical(product.seo.canonicalUrl, fallbackPath);
  const images = product.heroMediaUrl ? [{ url: storefrontUrl(product.heroMediaUrl), alt: product.name }] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: product.seo.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: 'Apple333',
      title,
      description,
      url: canonical,
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images: images?.map((image) => image.url) },
  };
}
