import type { PersianSearchExpansion, SearchCandidate } from '@/features/storefront/types/search';

const ARABIC_CHARACTER_REPLACEMENTS: Readonly<Record<string, string>> = {
  'ؤ': 'و',
  'إ': 'ا',
  'أ': 'ا',
  'ى': 'ی',
  'ي': 'ی',
  'ئ': 'ی',
  'ك': 'ک',
  'ة': 'ه',
  'ۀ': 'ه',
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ASCII_DIGITS = '0123456789';
const MAX_SYNONYM_CANDIDATES = 6;

/**
 * Phrase and token synonyms are intentionally small, curated, and local.
 * Search administration and merchant-specific aliases belong to a future PIM
 * configuration module rather than hard-coded product data in the storefront.
 */
const PHRASE_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  'اپل واچ': ['apple watch'],
  'مک بوک': ['macbook'],
  'مک مینی': ['mac mini'],
  'ایرپاد پرو': ['airpods pro'],
};

const TOKEN_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  'اپل': ['apple'],
  'آیفون': ['iphone', 'ایفون'],
  'ایفون': ['آیفون', 'iphone'],
  'آیپد': ['ipad', 'ایپد'],
  'ایپد': ['آیپد', 'ipad'],
  'ایرپاد': ['airpods', 'airpod'],
  'ایرپادز': ['airpods'],
  'مک': ['mac'],
  'واچ': ['watch'],
  'پرو': ['pro'],
  'مکس': ['max'],
  'مینی': ['mini'],
  'اولترا': ['ultra'],
  'گیگ': ['gb'],
  'گیگابایت': ['gb'],
  'iphone': ['آیفون', 'ایفون'],
  'ipad': ['آیپد', 'ایپد'],
  'airpod': ['ایرپاد'],
  'airpods': ['ایرپاد'],
  'apple': ['اپل'],
  'watch': ['واچ'],
  'pro': ['پرو'],
  'max': ['مکس'],
  'mini': ['مینی'],
  'ultra': ['اولترا'],
  'gb': ['گیگابایت', 'گیگ'],
};

/**
 * Deliberately small, reviewed corrections for high-frequency storefront
 * spelling mistakes. They are query candidates, never a claim of fuzzy or
 * ranked database search. Unicode escapes keep the source portable while the
 * normalized values remain Persian at runtime.
 */
const CURATED_TYPO_CORRECTIONS: Readonly<Record<string, readonly string[]>> = {
  '\u0627\u06cc\u0641\u0648\u0646': ['\u0622\u06cc\u0641\u0648\u0646', 'iphone'],
  '\u0627\u06cc\u0641\u0648\u062a': ['\u0622\u06cc\u0641\u0648\u0646', 'iphone'],
  '\u0627\u06cc\u0631\u067e\u0627\u062a': ['\u0627\u06cc\u0631\u067e\u0627\u062f', 'airpods'],
  '\u0645\u06a9\u0628\u0648\u06a9': ['macbook'],
  'iphon': ['iphone', '\u0622\u06cc\u0641\u0648\u0646'],
  'iphne': ['iphone', '\u0622\u06cc\u0641\u0648\u0646'],
  'airpodz': ['airpods', '\u0627\u06cc\u0631\u067e\u0627\u062f'],
  'macbok': ['macbook'],
};

function replaceDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => ASCII_DIGITS[PERSIAN_DIGITS.indexOf(digit)] ?? digit)
    .replace(/[٠-٩]/g, (digit) => ASCII_DIGITS[ARABIC_DIGITS.indexOf(digit)] ?? digit);
}

function replaceArabicCharacters(value: string): string {
  return value.replace(/[ؤإأىيئكةۀ]/g, (character) => ARABIC_CHARACTER_REPLACEMENTS[character] ?? character);
}

/**
 * Converts Persian/Arabic display variants into a stable search form.  This is
 * a query-side normalization only; it does not change PIM data or create a
 * PostgreSQL index.
 */
export function normalizePersianSearchTerm(value: string): string {
  return replaceDigits(replaceArabicCharacters(value.normalize('NFKC')))
    .toLocaleLowerCase('fa-IR')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0640]/g, '')
    .replace(/[\u200C\u200D\uFEFF]/g, ' ')
    .replace(/[\s_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizePersianSearchTerm(value: string): readonly string[] {
  const normalized = normalizePersianSearchTerm(value);
  return normalized ? normalized.split(' ') : [];
}

function addCandidate(candidates: SearchCandidate[], term: string, source: SearchCandidate['source']): void {
  const normalized = normalizePersianSearchTerm(term);
  if (!normalized || candidates.some((candidate) => candidate.term === normalized)) return;
  candidates.push({ term: normalized, source });
}

function expandTokenVariants(tokens: readonly string[]): readonly string[] {
  let variants = [tokens.join(' ')];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const alternatives = TOKEN_SYNONYMS[token] ?? [];
    if (alternatives.length === 0) continue;

    const next = [...variants];
    for (const alternative of alternatives) {
      for (const variant of variants) {
        const variantTokens = variant.split(' ');
        variantTokens[index] = alternative;
        next.push(variantTokens.join(' '));
        if (next.length >= MAX_SYNONYM_CANDIDATES) break;
      }
      if (next.length >= MAX_SYNONYM_CANDIDATES) break;
    }

    variants = Array.from(new Set(next.map(normalizePersianSearchTerm))).slice(0, MAX_SYNONYM_CANDIDATES);
  }

  return variants;
}

function expandCuratedTypoVariants(tokens: readonly string[]): readonly string[] {
  const variants: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    for (const correction of CURATED_TYPO_CORRECTIONS[token] ?? []) {
      const candidate = [...tokens];
      candidate[index] = correction;
      variants.push(candidate.join(' '));
      if (variants.length >= MAX_SYNONYM_CANDIDATES) return variants;
    }
  }
  return variants;
}

/**
 * Produces bounded candidate terms for the existing public PIM search API.
 * It does not implement typo correction or relevance ranking; those require a
 * deliberately provisioned index as described by `searchIndexEvolution`.
 */
export function expandPersianSearchSynonyms(value: string): PersianSearchExpansion {
  const normalizedTerm = normalizePersianSearchTerm(value);
  const tokens = normalizedTerm ? normalizedTerm.split(' ') : [];
  const candidates: SearchCandidate[] = [];

  addCandidate(candidates, normalizedTerm, 'normalized');
  for (const synonym of PHRASE_SYNONYMS[normalizedTerm] ?? []) {
    addCandidate(candidates, synonym, 'synonym');
  }
  for (const variant of expandTokenVariants(tokens)) {
    addCandidate(candidates, variant, variant === normalizedTerm ? 'normalized' : 'synonym');
    if (candidates.length >= MAX_SYNONYM_CANDIDATES) break;
  }
  for (const variant of expandCuratedTypoVariants(tokens)) {
    addCandidate(candidates, variant, 'typo');
    if (candidates.length >= MAX_SYNONYM_CANDIDATES) break;
  }

  return {
    normalizedTerm,
    tokens,
    candidates: candidates.slice(0, MAX_SYNONYM_CANDIDATES),
  };
}
