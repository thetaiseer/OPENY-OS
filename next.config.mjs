/** @type {import('next').NextConfig} */
const LEGACY_DOCS_MODULE_ROUTES = [
  '/invoice',
  '/quotation',
  '/client-contract',
  '/hr-contract',
  '/employees',
  '/accounting',
];

function buildRemotePatterns() {
  const patterns = [];

  // Cloudflare R2 public URL (e.g. https://files.example.com or https://pub-xxx.r2.dev)
  const r2Url = process.env.R2_PUBLIC_URL;
  if (r2Url) {
    try {
      const { hostname, protocol } = new URL(r2Url);
      patterns.push({ protocol: protocol.replace(':', ''), hostname });
    } catch {
      /* invalid URL — skip */
    }
  }

  // Supabase Storage CDN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const { hostname } = new URL(supabaseUrl);
      // Supabase storage lives on the same project domain
      patterns.push({ protocol: 'https', hostname });
      patterns.push({ protocol: 'https', hostname: `*.${hostname}` });
    } catch {
      /* invalid URL — skip */
    }
  }

  // Fallback: allow only known CDN patterns if env vars are missing at build time
  if (patterns.length === 0) {
    patterns.push({ protocol: 'https', hostname: '*.r2.dev' });
    patterns.push({ protocol: 'https', hostname: '*.supabase.co' });
  }

  return patterns;
}

const nextConfig = {
  images: {
    remotePatterns: buildRemotePatterns(),
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
