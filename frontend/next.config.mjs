/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_BASE;
    if (!backend) return [];
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
    ];
  },
};

export default nextConfig;
