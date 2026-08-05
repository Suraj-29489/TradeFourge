import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeSupabaseUrl } from "./config";
import { isOwner, isOwnerEmail } from "@/lib/config/owner";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  let supabaseUrl = sanitizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  let supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || supabaseUrl.includes("placeholder")) {
    supabaseUrl = "https://placeholder.supabase.co";
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes("placeholder")) {
    supabaseAnonKey = "placeholder-anon-key";
  }

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

  // Legacy redirect: /mission-control -> /admin-controls
  if (pathname.startsWith("/mission-control")) {
    const adminUrl = new URL("/admin-controls", request.url);
    return NextResponse.redirect(adminUrl);
  }

  // Always allow static files and auth callback route to execute directly
  if (pathname.startsWith("/auth/callback") || pathname.startsWith("/_next")) {
    return supabaseResponse;
  }

  // Check if env vars are configured before attempting network call
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")) {
    return supabaseResponse;
  }

  // Refresh auth user session
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Owner / Admin protected routes
    const ownerRoutes = [
      "/admin-controls",
      "/users",
      "/analytics",
      "/monitoring",
      "/feature-flags",
      "/developer-tools",
      "/announcements",
      "/feedback",
    ];

    const isOwnerRoute = ownerRoutes.some((route) => pathname.startsWith(route));

    // Protected general routes
    const protectedRoutes = [
      "/dashboard",
      "/journal",
      "/performance",
      "/reports",
      "/calendar",
      "/trades",
      "/upload",
      "/settings",
      "/statistics",
      ...ownerRoutes,
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

    // Owner protection: non-owners accessing owner routes get redirected to /dashboard
    if (isOwnerRoute) {
      if (!user || !isOwner({ role: user.user_metadata?.role, email: user.email })) {
        const dashboardUrl = new URL("/dashboard", request.url);
        return NextResponse.redirect(dashboardUrl);
      }
    }

    // Redirect authenticated user attempting to access auth page to /dashboard
    if (user && isAuthRoute) {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  } catch {
    // Graceful fallback for network issues
  }

  return supabaseResponse;
}
