/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' }
    ]
  },
  async redirects() {
    return [
      {
        source: '/docs-legacy',
        destination: '/docs-legacy/index.html',
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
