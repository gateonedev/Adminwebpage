import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Refreshes the Supabase session cookie on every request and gates routes:
 *   - Unauthenticated requests under /(admin) (i.e. /sites, /admins) → /login
 *   - Authenticated requests on /login → /sites
 *
 * Role validation (super_admin) happens in app/(admin)/layout.tsx so we
 * don't need to query the users table from middleware on every request.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const isLogin = pathname === '/login';
  const adminPrefixes = [
    '/dashboard',
    '/users',
    '/barriers',
    '/groups',
    '/logs',
    '/guests',
    '/sites',
    '/admins',
    '/audit',
    '/account',
  ];
  const isAdminArea = adminPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  if (!user && isAdminArea) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every path except Next internals and static files
    '/((?!_next/static|_next/image|favicon.ico|gate-one-logo.svg|gate-one-logo-dark.svg).*)',
  ],
};
