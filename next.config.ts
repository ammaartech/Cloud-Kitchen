import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Product imagery is database-driven (PRD 13), so the host allowlist is
    // what constrains it rather than any hardcoded asset path.
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  typedRoutes: true,
};

export default nextConfig;
