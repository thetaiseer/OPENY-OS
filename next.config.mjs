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
  async rewrites() {
    return [
      { source: '/invoice', destination: '/docs-legacy/index.html' },
      { source: '/quotation', destination: '/docs-legacy/index.html' },
      { source: '/client-contract', destination: '/docs-legacy/index.html' },
      { source: '/hr-contract', destination: '/docs-legacy/index.html' },
      { source: '/employees', destination: '/docs-legacy/index.html' },
      { source: '/accounting', destination: '/docs-legacy/index.html' },
    ];
  },
};
export default nextConfig;
