/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // 旧来の API 形式
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
      // 新しい *.firebasestorage.app の直リンク
      {
        protocol: 'https',
        hostname: '**.firebasestorage.app', // ワイルドカード可（Next 13.4+）
        pathname: '/**',
      },
    ],
  },
};
export default nextConfig;
