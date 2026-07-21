import { CompareWorkbench } from '@/components/store/compare-workbench';

import { getStorefrontComparison } from '../services/server-catalog';

/** Comparison selection remains interactive, while valid initial slugs are SSR preloaded. */
export async function CompareContainer({ initialSlugs }: { initialSlugs: readonly string[] }) {
  const comparison = await getStorefrontComparison(initialSlugs);
  if (comparison) return <CompareWorkbench initialSlugs={initialSlugs} initialComparison={comparison} />;
  return <CompareWorkbench initialSlugs={initialSlugs} />;
}
