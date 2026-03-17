// API route: POST /api/generate-seo — generates SEO title + description via Claude
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { SEO_SYSTEM_PROMPT, buildSeoPrompt } from "@/lib/ai-prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const product = await request.json();

    if (!product?.title) {
      return NextResponse.json({ error: "Product title is required" }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: SEO_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildSeoPrompt(product) }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const seo = JSON.parse(jsonMatch[0]);
    return NextResponse.json(seo);
  } catch (error) {
    console.error("SEO generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate SEO" },
      { status: 500 }
    );
  }
}
