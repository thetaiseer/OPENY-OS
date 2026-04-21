/** @type {import('next').NextConfig} */
const LEGACY_DOCS_MODULE_ROUTES = ['/invoice', '/quotation', '/client-contract', '/hr-contract', '/employees', '/accounting'];

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
    return LEGACY_DOCS_MODULE_ROUTES.map((source) => ({
      source,
      destination: '/docs-legacy/index.html',
    }));
  },
};
export default nextConfig;
