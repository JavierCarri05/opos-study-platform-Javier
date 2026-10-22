import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Rutas de API no deben ser redirigidas a páginas HTML de login
  if (path.startsWith('/api')) {
    return supabaseResponse;
  }

  // Rutas públicas de autenticación
  const isAuthRoute = path === '/login' || path === '/register';

  if (!user && !isAuthRoute && path !== '/') {
    // Si no está autenticado, redirigir a login y limpiar cookies de rol
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectRes = NextResponse.redirect(url);
    redirectRes.cookies.delete('opos_cached_role');
    redirectRes.cookies.delete('opos_cached_status');
    redirectRes.cookies.delete('opos_cached_uid');
    return redirectRes;
  }

  if (user) {
    // Optimización de concurrencia: Verificar si el rol y estado ya están en caché de sesión
    // para evitar golpear la base de datos en cada navegación / prefetch
    const cachedUid = request.cookies.get('opos_cached_uid')?.value;
    const cachedRole = request.cookies.get('opos_cached_role')?.value;
    const cachedStatus = request.cookies.get('opos_cached_status')?.value;

    let role: string = cachedRole || '';
    let status: string = cachedStatus || '';

    // Si la caché no existe, no coincide con el usuario, o está en /pending (revalidación en vivo)
    const needsFreshCheck = !cachedUid || cachedUid !== user.id || !role || !status || path === '/pending';

    if (needsFreshCheck) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', user.id)
        .single();

      role = (profile?.role as string) || 'student';
      status = (profile?.status as string) || 'pending';

      // Guardar en cookie de sesión por 3 minutos (180s) para absorción masiva de peticiones
      supabaseResponse.cookies.set('opos_cached_uid', user.id, {
        maxAge: 180,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
      supabaseResponse.cookies.set('opos_cached_role', role, {
        maxAge: 180,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
      supabaseResponse.cookies.set('opos_cached_status', status, {
        maxAge: 180,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    const isPending = status === 'pending' || status === 'rejected';
    const isAdmin = role === 'admin';

    // Si el usuario está pendiente y no está en la página de aviso
    if (isPending && path !== '/pending' && !isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/pending';
      return NextResponse.redirect(url);
    }

    // Si ya está aprobado y está intentando acceder a /pending o /login
    if (!isPending && (path === '/pending' || isAuthRoute)) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Proteger rutas de admin
    if (path.startsWith('/admin') && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
