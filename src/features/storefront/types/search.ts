import type { PublicProductCardDto } from '@/modules/catalog/types';
import type { CatalogPageQuery } from '@/modules/catalog/validators';

/**
 * A validated search request deliberately reuses the Phase 04 catalog query
 * contract.  It is not a second product or catalog model.
 */
export type StorefrontSearchInput = Readonly<Omit<CatalogPageQuery, 'query'> & {
  query: string;
}>;

/** The public response shape returned by GET /api/store/products. */
export type PublicPimCatalogPageDto = Readonly<{
  items: readonly PublicProductCardDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

export type SearchCandidateSource = 'normalized' | 'synonym' | 'typo';

export type SearchCandidate = Readonly<{
  term: string;
  source: SearchCandidateSource;
}>;

export type PersianSearchExpansion = Readonly<{
  normalizedTerm: string;
  tokens: readonly string[];
  candidates: readonly SearchCandidate[];
}>;

/**
 * This interface is intentionally not implemented in Phase 05.
 *
 * It is the seam for a future PostgreSQL pg_trgm/tsvector implementation or
 * an OpenSearch fuzzy-query provider.  The current PIM API only provides its
 * existing bounded `contains` search and must not be presented as typo ranked.
 */
export interface TypoToleranceProvider<TResult> {
  readonly provider: 'postgres-trigram' | 'opensearch-fuzzy';
  readonly enabled: boolean;
  search(input: StorefrontSearchInput): Promise<TResult>;
}

export type TypoToleranceDesign = Readonly<{
  status: 'not-implemented';
  currentBehavior: 'normalized-synonym-and-curated-typo-candidates-only';
  requiredBeforeEnablement: readonly string[];
}>;

/**
 * Exported implementation plan, not a database migration or a claim that a
 * search index exists today.  Enabling either step needs its own reviewed
 * schema migration, performance benchmark, relevance tests, and rollout.
 */
export const typoToleranceDesign: TypoToleranceDesign = {
  status: 'not-implemented',
  currentBehavior: 'normalized-synonym-and-curated-typo-candidates-only',
  requiredBeforeEnablement: [
    'Add and benchmark PostgreSQL pg_trgm and/or a weighted tsvector index.',
    'Define Persian relevance, typo, and zero-result acceptance tests.',
    'Add query observability, rate controls, and a reversible rollout plan.',
  ],
};

export type SearchIndexEvolution = Readonly<{
  current: Readonly<{
    backend: 'phase-04-public-pim-postgresql';
    indexStatus: 'no-dedicated-search-index';
    rankingStatus: 'no-typo-ranking';
  }>;
  plannedPostgres: Readonly<{
    backend: 'postgresql';
    suggestedCapabilities: readonly ('pg_trgm' | 'tsvector' | 'weighted-ranking')[];
  }>;
  futureOpenSearch: Readonly<{
    backend: 'opensearch';
    suggestedCapabilities: readonly ('persian-analyzer' | 'synonyms' | 'fuzzy-ranking')[];
  }>;
}>;

/**
 * Architectural documentation in code.  The application currently calls the
 * Phase 04 public PIM endpoint; it does not create an index or run fuzzy SQL.
 */
export const searchIndexEvolution: SearchIndexEvolution = {
  current: {
    backend: 'phase-04-public-pim-postgresql',
    indexStatus: 'no-dedicated-search-index',
    rankingStatus: 'no-typo-ranking',
  },
  plannedPostgres: {
    backend: 'postgresql',
    suggestedCapabilities: ['pg_trgm', 'tsvector', 'weighted-ranking'],
  },
  futureOpenSearch: {
    backend: 'opensearch',
    suggestedCapabilities: ['persian-analyzer', 'synonyms', 'fuzzy-ranking'],
  },
};

/** A transport is injected so the feature can only consume a public PIM contract. */
export interface PublicPimCatalogSearchTransport {
  listProducts(input: StorefrontSearchInput): Promise<PublicPimCatalogPageDto>;
}

export type StorefrontSearchResult = Readonly<{
  items: readonly PublicProductCardDto[];
  page: number;
  pageSize: number;
  /** Totals remain exact only for the normalized primary PIM query. */
  primaryTotal: number;
  primaryTotalPages: number;
  candidates: readonly SearchCandidate[];
  unavailableCandidates: readonly SearchCandidate[];
  /** Synonym merging can add items outside the primary PIM result total. */
  isApproximate: boolean;
}>;
