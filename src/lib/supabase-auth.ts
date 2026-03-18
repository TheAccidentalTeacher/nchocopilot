// Supabase Auth — server-only client for cookie-based sessions
// For browser client, use createBrowserClient directly in client components
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ── Server client (used in Server Components, API routes) ──
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in Server Components (read-only)
          }
        },
      },
    }
  );
}
