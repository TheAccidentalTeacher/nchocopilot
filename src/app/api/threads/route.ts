// GET /api/threads — list all chat threads
// POST /api/threads — create a new thread

import { NextResponse } from "next/server";
import { getThreads, createThread } from "@/lib/supabase";

export async function GET() {
  try {
    const threads = await getThreads();
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
    const { title } = await request.json().catch(() => ({ title: undefined }));
    const thread = await createThread(title);
    return NextResponse.json(thread);
  } catch (error) {
    console.error("Thread create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create thread" },
      { status: 500 }
    );
  }
}
