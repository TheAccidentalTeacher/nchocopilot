// GET /api/threads/[id] — get a single thread
// PATCH /api/threads/[id] — rename a thread
// DELETE /api/threads/[id] — delete a thread

import { NextResponse } from "next/server";
import { getThread, updateThreadTitle, deleteThread } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const thread = await getThread(id);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    return NextResponse.json(thread);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title } = await request.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    await updateThreadTitle(id, title.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteThread(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
