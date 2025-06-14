/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed swcMinify: false and experimental configurations
  // to allow Next.js to use its default SWC optimizations
  // which are required for proper module bundling and resolution
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        ws: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig