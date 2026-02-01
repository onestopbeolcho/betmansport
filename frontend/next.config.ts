import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://3.26.129.31:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
