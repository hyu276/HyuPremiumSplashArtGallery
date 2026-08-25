const MEDIA_BASE=(process.env.NEXT_PUBLIC_MEDIA_BASE_URL||'https://hyu-premium-media.csquocnguyen.workers.dev').replace(/\/$/,'');

/** @type {import('next').NextConfig} */
const nextConfig={
  async redirects(){
    return [{
      source:'/media/:source(owner|huy9vnd)/:path*',
      destination:`${MEDIA_BASE}/media/legacy/:source/artworks/:path*`,
      permanent:true
    }];
  }
};

export default nextConfig;
