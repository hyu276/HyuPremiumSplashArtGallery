import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'zkrhwqgmynbbmoktokdq.supabase.co' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' }
    ]
  },
  async redirects() {
    return [
      { source: '/', destination: '/character/', permanent: true },
      { source: '/characters/', destination: '/character/', permanent: true },
      { source: '/about.html', destination: '/about/', permanent: true },
      { source: '/news.html', destination: '/news/', permanent: true },
      { source: '/blog.html', destination: '/blog/', permanent: true }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/assets/:path*',
        destination: 'https://raw.githubusercontent.com/hyu276/HyuPremiumSplashArtGallery/main/assets/:path*'
      }
    ];
  }
};

export default nextConfig;
