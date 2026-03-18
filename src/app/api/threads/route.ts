// GET /api/threads — list all chat threads for the current user
// POST /api/threads — create a new thread

import { NextResponse } from "next/server";
import { getThreads, createThread } from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const user = await getAuthUser();
    const threads = await getThreads(user?.id);
    return NextResponse.json(threads);
  } catch (error) {
    console.error("Threads fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch threads" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const { title } = await request.json().catch(() => ({ title: undefined }));
    const thread = await createThread(title, user?.id);
    return NextResponse.json(thread);
  } catch (error) {
    console.error("Thread create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread" },
      { status: 500 }
    );
  }
}
