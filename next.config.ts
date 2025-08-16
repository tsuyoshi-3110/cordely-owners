// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Firebase Storage のダウンロードURLを許可
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        // 必要ならパスも絞れます:
        // pathname: "/v0/b/**",
      },
      // まれに storage.googleapis.com を使う場合に備えて
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
  // お好みで：lucide-reactの最適化など
  // experimental: {
  //   optimizePackageImports: ["lucide-react"],
  // },
};

export default nextConfig;
