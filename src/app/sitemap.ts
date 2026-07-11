import type { MetadataRoute } from 'next';

function applicationUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: applicationUrl(),
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}
