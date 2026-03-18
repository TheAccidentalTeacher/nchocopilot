// Extract user ID from Supabase auth cookie in API routes
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getAuthUser(): Promise<{ id: string; email: string } | null> {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
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
              // Ignored in read-only context
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}
