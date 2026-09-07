/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Charts are the only heavy dependency; keep them out of the shared bundle.
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
