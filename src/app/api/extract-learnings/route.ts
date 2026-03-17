// POST /api/extract-learnings — Auto-extract store preferences from conversations
// Modeled after Chapterhouse's extract-learnings pattern

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { addStoreMemory, trackCost, type ChatMessage } from "@/lib/supabase";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { messages } = (await request.json()) as {
      threadId: string;
      messages: ChatMessage[];
    };

    if (!messages || messages.length < 2) {
      return NextResponse.json({ extracted: 0 });
    }

    // Format recent messages for analysis
    const transcript = messages
      .map((m) => `${m.role === "user" ? "Anna" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You extract store management facts and preferences from conversations between Anna (store owner) and her AI assistant.

Extract ONLY concrete, reusable facts:
- Product preferences ("Anna wants Ravensburger puzzles in the Games collection")
- Taxonomy decisions ("Book:Classics maps to high school age range")  
- Brand rules ("Don't use the word 'journey' in descriptions")
- Vendor preferences ("Anna likes Ace Academic for workbooks")
- Content decisions ("Blog posts should be 800-1200 words")

Do NOT extract:
- Greetings or small talk
- Questions asked but not answered
- Things the assistant said (only extract Anna's decisions)
- Vague opinions without actionable meaning

Return a JSON array of objects: [{"fact": "...", "category": "preference|product|brand|taxonomy|general"}]
Return an empty array [] if no extractable facts exist.`,
      messages: [
        {
          role: "user",
          content: `Extract actionable facts from this conversation:\n\n${transcript}`,
        },
      ],
    });

    await trackCost(
      response.usage.input_tokens,
      response.usage.output_tokens,
      "extract-learnings"
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ extracted: 0 });
    }

    const facts: Array<{ fact: string; category: string }> = JSON.parse(
      jsonMatch[0]
    );

    for (const f of facts) {
      await addStoreMemory(f.fact, f.category || "general", "auto");
    }

    return NextResponse.json({ extracted: facts.length, facts });
  } catch (error) {
    console.error("Extract learnings error:", error);
    return NextResponse.json({ extracted: 0, error: String(error) });
  }
}
