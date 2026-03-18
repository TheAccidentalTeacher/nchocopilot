// POST /api/chat — Streaming chat with Claude tool_use
// The brain of NCHO Tools v2

import Anthropic from "@anthropic-ai/sdk";
import { buildLiveContext } from "@/lib/store-context";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/chat-tools";
import {
  getThread,
  createThread,
  updateThreadMessages,
  trackCost,
  type ChatMessage,
  type ToolCallRecord,
} from "@/lib/supabase";
import { getAuthUser } from "@/lib/auth-helpers";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  try {
    const { threadId, message, attachments } = await request.json();

    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!message?.trim() && !hasAttachments) {
      return new Response(JSON.stringify({ error: "Message or attachment is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get or create thread
    const user = await getAuthUser();
    let thread = threadId ? await getThread(threadId) : null;
    if (!thread) {
      thread = await createThread(undefined, user?.id);
    }

    // Build context
    const userName = user?.email?.split("@")[0] || "user";
    const systemPrompt = await buildLiveContext() + `\n\nThe current user is ${userName}.`;

    // Build message history from thread + new message
    const historyMessages: Anthropic.MessageParam[] = [];
    for (const msg of thread.messages.slice(-20)) {
      historyMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Build the new user message content blocks
    const userContentBlocks: Anthropic.ContentBlockParam[] = [];

    // Add text message if present
    if (message?.trim()) {
      userContentBlocks.push({ type: "text", text: message });
    }

    // Process attachments
    if (hasAttachments) {
      for (const att of attachments) {
        if (att.type === "image" && att.data) {
          // Claude vision: base64 image content block
          const mediaType = att.mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
          userContentBlocks.push({
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: att.data,
            },
          });
        } else if (att.type === "file" && att.data) {
          // Text file: inject as labeled text block
          const truncated = att.data.length > 50000
            ? att.data.slice(0, 50000) + "\n\n[... truncated at 50,000 characters]"
            : att.data;
          userContentBlocks.push({
            type: "text",
            text: `--- File: ${att.name} (${att.mimeType}) ---\n${truncated}\n--- End of ${att.name} ---`,
          });
        }
      }
    }

    historyMessages.push({
      role: "user",
      content: userContentBlocks.length === 1 && userContentBlocks[0].type === "text"
        ? (userContentBlocks[0] as Anthropic.TextBlockParam).text
        : userContentBlocks,
    });

    // For thread storage, build a plain-text display version
    const attachmentLabels = hasAttachments
      ? attachments.map((a: { type: string; name: string }) =>
          a.type === "image" ? `\ud83d\udcf7 ${a.name}` : `\ud83d\udcc4 ${a.name}`
        )
      : [];
    const storageContent = [message || "", ...attachmentLabels].filter(Boolean).join("\n");

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          send("thread", { id: thread!.id });

          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let fullResponse = "";
          const toolCalls: ToolCallRecord[] = [];

          // Agentic loop — keep calling Claude until it stops using tools
          let currentMessages = [...historyMessages];
          let maxIterations = 10;

          while (maxIterations-- > 0) {
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: systemPrompt,
              tools: TOOL_DEFINITIONS,
              messages: currentMessages,
            });

            totalInputTokens += response.usage.input_tokens;
            totalOutputTokens += response.usage.output_tokens;

            // Process response content blocks
            let hasToolUse = false;
            const toolResults: Anthropic.MessageParam[] = [];

            for (const block of response.content) {
              if (block.type === "text") {
                fullResponse += block.text;
                send("text", { content: block.text });
              } else if (block.type === "tool_use") {
                hasToolUse = true;
                send("tool_start", { tool: block.name, input: block.input });

                // Execute the tool
                const result = await executeTool(
                  block.name,
                  block.input as Record<string, unknown>
                );

                toolCalls.push({
                  tool: block.name,
                  input: block.input as Record<string, unknown>,
                  result: result.slice(0, 500),
                });

                send("tool_result", {
                  tool: block.name,
                  result: JSON.parse(result),
                });

                // Add tool result for next iteration
                toolResults.push({
                  role: "user" as const,
                  content: [
                    {
                      type: "tool_result" as const,
                      tool_use_id: block.id,
                      content: result,
                    },
                  ],
                });
              }
            }

            // If no tool use, we're done
            if (!hasToolUse) {
              break;
            }

            // Continue the loop with tool results
            currentMessages = [
              ...currentMessages,
              { role: "assistant" as const, content: response.content },
              ...toolResults,
            ];
          }

          // Save messages to thread
          const updatedMessages: ChatMessage[] = [
            ...thread!.messages,
            {
              role: "user",
              content: storageContent,
              timestamp: new Date().toISOString(),
            },
            {
              role: "assistant",
              content: fullResponse,
              tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
              timestamp: new Date().toISOString(),
            },
          ];

          await updateThreadMessages(thread!.id, updatedMessages);

          // Track cost
          await trackCost(totalInputTokens, totalOutputTokens, "chat");

          send("done", {
            threadId: thread!.id,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          });

          // Trigger extract-learnings in the background
          triggerExtractLearnings(thread!.id, updatedMessages.slice(-6)).catch(
            () => {}
          );
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "Chat failed",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Chat failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Fire-and-forget: extract learnings from the conversation
async function triggerExtractLearnings(
  threadId: string,
  recentMessages: ChatMessage[]
): Promise<void> {
  const origin =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  await fetch(`${origin}/api/extract-learnings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, messages: recentMessages }),
  });
}
