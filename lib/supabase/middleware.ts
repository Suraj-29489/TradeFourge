import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // Always allow static files and auth callback route to execute directly
  if (pathname.startsWith("/auth/callback") || pathname.startsWith("/_next")) {
    return supabaseResponse;
  }

  // Refresh auth user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // List of protected routes requiring login
  const protectedRoutes = [
    "/dashboard",
    "/journal",
    "/performance",
    "/reports",
    "/calendar",
    "/trades",
    "/upload",
    "/settings",
    "/mission-control",
    "/statistics",
  ];

  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup";

  // Redirect unauthenticated user attempting to access protected route to /login
  if (!user && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated user attempting to access auth page to /dashboard
  if (user && isAuthRoute) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
