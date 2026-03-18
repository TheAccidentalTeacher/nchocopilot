// POST /api/auth/logout — sign out and redirect to login
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-auth";

export async function POST() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
