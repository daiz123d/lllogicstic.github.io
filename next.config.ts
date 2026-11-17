import type { NextConfig } from 'next';

const repositoryBasePath = process.env.GITHUB_ACTIONS ? '/lllogicstic.github.io' : '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: repositoryBasePath,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
