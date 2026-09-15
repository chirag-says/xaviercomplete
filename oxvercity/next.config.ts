import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  // Sibling projects on the same drive have their own lockfiles; trace from here.
  outputFileTracingRoot: __dirname,
  // The design ships Framer's own responsive srcsets and sizes, and the CSS
  // positions the images explicitly. The optimiser would rewrite intrinsic
  // sizes and wrappers that the layout depends on, so images stay as plain
  // <img> elements served from /public.
  images: { unoptimized: true },
};

export default nextConfig;
