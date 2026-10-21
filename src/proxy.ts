import { withAuth } from 'next-auth/middleware';

/**
 * Page guard: every app page needs a signed-in user; anonymous visitors are
 * sent to /login. API routes are NOT matched here: they check the session
 * themselves (requireUser / requireAdmin) and answer 401/403 as JSON.
 */
export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
    '/((?!api|login|register|_next/static|_next/image|icons/|sw.js|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt).*)',
  ],
};
