import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Barrel import'u (ikon başına modül) yerine kullanılan ikonları doğrudan
    // çözer; dev derleme süresini ve client bundle'ı küçültür.
    optimizePackageImports: ['@phosphor-icons/react'],
  },
};

export default nextConfig;
