import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
      ]
    }];
  }
};

export default withSentryConfig(nextConfig, {
  // Releases/source-map uploads require an explicitly provisioned build token.
  // Until that exists, keep the SDK wired without silently sending build data.
  silent: true,
  sourcemaps: { disable: true },
  telemetry: false,
  webpack: {
    treeshake: { removeDebugLogging: true }
  }
});
