// API route: POST /api/generate-blog — generates a blog post via Claude
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { BLOG_SYSTEM_PROMPT, buildBlogPrompt } from "@/lib/ai-prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { topic, keywords } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: BLOG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildBlogPrompt(topic, keywords) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const blog = JSON.parse(jsonMatch[0]);
    return NextResponse.json(blog);
  } catch (error) {
    console.error("Blog generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate blog post" },
      { status: 500 }
    );
  }
}
