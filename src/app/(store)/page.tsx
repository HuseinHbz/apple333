import { StorefrontHomeContainer } from '@/features/storefront/containers/storefront-home-container';

export const revalidate = 60;

export default async function StorefrontHomePage() {
  return <StorefrontHomeContainer />;
}
