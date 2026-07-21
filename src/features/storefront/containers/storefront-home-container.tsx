import { StoreHome } from '@/components/store/store-home';

import { getStorefrontHomeSnapshot } from '../services/server-catalog';

/** Server composition over the approved public PIM projection. */
export async function StorefrontHomeContainer() {
  try {
    const initialData = await getStorefrontHomeSnapshot();
    return <StoreHome initialData={initialData} />;
  } catch {
    // A build artifact is intentionally database-independent. At runtime the
    // client uses the same public PIM API and renders its explicit error state
    // if the catalog service remains unavailable.
    return <StoreHome />;
  }
}
