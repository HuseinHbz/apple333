import { expandPersianSearchSynonyms } from '@/features/storefront/services/persian-search';
import { parseStorefrontSearchInput } from '@/features/storefront/schemas/search';
import type {
  PublicPimCatalogPageDto,
  PublicPimCatalogSearchTransport,
  SearchCandidate,
  StorefrontSearchInput,
  StorefrontSearchResult,
} from '@/features/storefront/types/search';

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type PublicApiEnvelope<T> = Readonly<{
  success: boolean;
  data?: T;
  error?: Readonly<{ code?: string; message?: string }>;
}>;

export class PublicPimCatalogSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicPimCatalogSearchError';
  }
}

function isPublicPimCatalogPage(value: unknown): value is PublicPimCatalogPageDto {
  if (typeof value !== 'object' || value === null) return false;
  const page = value as Partial<PublicPimCatalogPageDto>;
  return Array.isArray(page.items)
    && typeof page.page === 'number'
    && typeof page.pageSize === 'number'
    && typeof page.total === 'number'
    && typeof page.totalPages === 'number';
}

function isPublicApiEnvelope(value: unknown): value is PublicApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

/**
 * Builds only the canonical Phase 04 public PIM endpoint.  No database query,
 * internal repository, or unsupported brand/model filter is reachable here.
 */
export function buildPublicPimCatalogSearchPath(input: StorefrontSearchInput): string {
  const query = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
    query: input.query,
    sort: input.sort,
  });

  if (input.brand !== undefined) query.set('brand', input.brand);
  if (input.model !== undefined) query.set('model', input.model);
  if (input.category !== undefined) query.set('category', input.category);
  if (input.color !== undefined) query.set('color', input.color);
  if (input.storage !== undefined) query.set('storage', input.storage);
  if (input.minPriceRials !== undefined) query.set('minPriceRials', input.minPriceRials.toString());
  if (input.maxPriceRials !== undefined) query.set('maxPriceRials', input.maxPriceRials.toString());
  if (input.inStock !== undefined) query.set('inStock', String(input.inStock));
  if (input.collection !== undefined) query.set('collection', input.collection);

  return `/api/store/products?${query.toString()}`;
}

/**
 * Browser-facing public-PIM adapter.  It deliberately uses the existing API
 * response envelope and credentials policy.  It is not a direct PostgreSQL
 * client and does not add a true search index or typo ranking.
 */
export async function fetchPublicPimCatalogSearchPage(
  input: StorefrontSearchInput,
  fetcher: FetchLike = fetch,
): Promise<PublicPimCatalogPageDto> {
  const response = await fetcher(buildPublicPimCatalogSearchPath(input), {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PublicPimCatalogSearchError('The public product search returned unreadable JSON.');
  }

  if (!isPublicApiEnvelope(payload)) {
    throw new PublicPimCatalogSearchError('The public product search returned an invalid response envelope.');
  }

  if (!response.ok || !payload.success || !isPublicPimCatalogPage(payload.data)) {
    throw new PublicPimCatalogSearchError(payload.error?.message ?? 'The public product search request failed.');
  }

  return payload.data;
}

export function createPublicPimCatalogSearchTransport(fetcher?: FetchLike): PublicPimCatalogSearchTransport {
  return {
    listProducts: (input) => fetchPublicPimCatalogSearchPage(input, fetcher),
  };
}

function mergePages(
  pages: readonly Readonly<{ candidate: SearchCandidate; page: PublicPimCatalogPageDto }>[],
  pageSize: number,
): PublicPimCatalogPageDto['items'] {
  const seen = new Set<string>();
  const items: PublicPimCatalogPageDto['items'][number][] = [];

  for (const { page } of pages) {
    for (const product of page.items) {
      const identity = product.id || product.slug;
      if (seen.has(identity)) continue;
      seen.add(identity);
      items.push(product);
      if (items.length >= pageSize) return items;
    }
  }

  return items;
}

/**
 * Executes a bounded primary query plus optional synonym queries through the
 * public PIM contract.  The primary query is authoritative for pagination;
 * merged synonym results are marked approximate rather than being misreported
 * as typo-tolerant or globally ranked PostgreSQL search results.
 */
export function createPublicPimCatalogSearchAdapter(transport: PublicPimCatalogSearchTransport) {
  return {
    async search(rawInput: unknown): Promise<StorefrontSearchResult> {
      const input = parseStorefrontSearchInput(rawInput);
      const expansion = expandPersianSearchSynonyms(input.query);
      const [primaryCandidate, ...optionalCandidates] = expansion.candidates;

      if (!primaryCandidate) {
        throw new PublicPimCatalogSearchError('The normalized search query produced no candidate.');
      }

      const primaryPage = await transport.listProducts({ ...input, query: primaryCandidate.term });
      const settled = await Promise.all(optionalCandidates.map(async (candidate) => {
        try {
          return { candidate, page: await transport.listProducts({ ...input, query: candidate.term }) };
        } catch {
          return null;
        }
      }));
      const availablePages = [
        { candidate: primaryCandidate, page: primaryPage },
        ...settled.flatMap((result) => result === null ? [] : [result]),
      ];
      const unavailableCandidates = optionalCandidates.filter((candidate) => !settled.some((result) => result?.candidate.term === candidate.term));

      return {
        items: mergePages(availablePages, primaryPage.pageSize),
        page: primaryPage.page,
        pageSize: primaryPage.pageSize,
        primaryTotal: primaryPage.total,
        primaryTotalPages: primaryPage.totalPages,
        candidates: expansion.candidates,
        unavailableCandidates,
        isApproximate: expansion.candidates.length > 1,
      };
    },
  };
}
