const isProd = process.env.NODE_ENV === 'production';

/**
 * Content-Security-Policy (production only: the dev server needs eval for hot reload).
 * - Everything is same-origin: no third-party scripts, styles, fonts, images or connections.
 * - 'unsafe-inline' for scripts is required by Next.js App Router's inline hydration data;
 *   the other directives still stop injected content from loading anything from elsewhere
 *   or sending data out (connect-src), framing the app (frame-ancestors) or using <object>.
 * - blob: / data: images are for the photo preview and the generated icons.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // camera=(self): the photo picker may open the camera; nothing else is needed
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Content-Security-Policy', value: csp }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // do not advertise the framework
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Authenticated JSON must never be stored by a shared cache or the browser's back/forward cache.
      // (/api/photos sets its own private, immutable caching.)
      { source: '/api/:path((?!photos).*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
