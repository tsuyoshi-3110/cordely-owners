/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // シンプルにドメイン許可
    domains: ['firebasestorage.googleapis.com'],

    // 念のためパスパターンでも許可
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        // Firebase Storage の REST URL パターン
        // 例: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/...
        pathname: '/v0/b/**',
      },
    ],
  },
};

export default nextConfig;
