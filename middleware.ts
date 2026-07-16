import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Session çerezini gerektiğinde yeniler ve rotaları yönlendirir:
 *   - Oturumsuz istekler admin alanında → /login
 *   - Oturumlu istekler /login'de → /dashboard
 *
 * Performans/güvenlik dengesi:
 * - getSession() çerezden okur ve AĞA ÇIKMAZ; access token süresi dolmuşsa
 *   refresh edip yeni çerezleri yazar (server component'ler çerez yazamadığı
 *   için refresh'in adresi burasıdır). Eski getUser() her istekte uzak Auth
 *   sunucusunu çağırıyordu (~230 ms) — navigasyon yavaşlığının ana sebebiydi.
 * - Middleware yalnızca yönlendirme UX'i yapar. Gerçek yetkilendirme
 *   requireAdmin() (sunucu doğrulamalı getUser + RLS'li users okuması) ve
 *   DB'deki RLS'tedir; sahte bir çerez burayı geçse bile layout'ta düşer.
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

  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  const isLogin = pathname === '/login';

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Yalnızca korunan admin rotaları + /login. Statik varlıklar, API ve diğer
  // her şey middleware'e hiç girmez.
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/users/:path*',
    '/barriers/:path*',
    '/groups/:path*',
    '/logs/:path*',
    '/guests/:path*',
    '/notifications/:path*',
    '/sites/:path*',
    '/admins/:path*',
    '/audit/:path*',
    '/account/:path*',
  ],
};
