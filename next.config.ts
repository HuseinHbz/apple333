import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // The bare-metal deployment script builds into a unique staging directory
  // and atomically swaps it into .next only after the standalone artifact is
  // complete. Normal local/CI builds continue to use .next.
  distDir: process.env.APPLE333_NEXT_DIST_DIR ?? '.next',
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
