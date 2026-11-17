import type { NextConfig } from 'next';

// GitHub Pages serves the site from the root of its custom domain (kldvn.com).
// Prefixing assets with the repository name makes the page load without its CSS.
const repositoryBasePath = '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: repositoryBasePath,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
