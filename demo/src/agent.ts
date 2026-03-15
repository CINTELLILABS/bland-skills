import {
  query,
  tool,
  createSdkMcpServer,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { createBlandMcpServer } from "../../dist/bland-mcp.js";

type SendTelegramFn = (chatId: string, text: string) => Promise<void>;

interface QueuedMessage {
  content: string;
}

const METABOT_INSTRUCTIONS = `You are Metabot, a personal assistant that manages appointments and communications via voice calls and messaging.

RULES:
- Always use the send_telegram_message tool to communicate with the user. Never respond with plain text — the user can only see Telegram messages.
- When you receive a webhook payload, determine its type:
  - Bland post-call webhooks contain call_id, transcripts, and status fields.
  - Twilio SMS webhooks contain From, To, Body fields.
  Parse accordingly and summarize for the user.
- When dispatching calls, use the Bland MCP tools (bland_persona_list, bland_call_send, bland_call_get, etc.). Always use personas to make calls — list personas first to find the right one and its dedicated number.
- After dispatching a call, tell the user it's in progress and you'll update them when it completes. Do NOT poll — a post-call webhook will arrive automatically when the call ends.
- When you create a call, do NOT ask the user how they want to follow up. Tell them the call is dispatched and you'll notify them when it completes. Then stop — do not poll. Wait for the incoming webhook.
- When an inbound event requires user action (e.g., confirming an appointment time), message the user with the options and wait for their reply before taking action.
- When sending messages to the user, keep them conversational, not like a report. For e.g, if you receive an SMS, say something 'I received an SMS from [sender]. Here's what they said: [message]'. Let me know if __ .
- If a call completes or you've dispatched it, don't return the call ID etc, just say 'Call completed' or 'Call dispatched'. If you want to give a summary of the call, say something like 'The call with [caller] went well! They said [something about the call]'. If they ask for transcripts, just provide the back and forth. Don't use unnecessary emojis. If input is required from the user, say something like 'I need to know if you want to confirm the appointment for [time]'`;


export function createAgent(config: {
  skillsDir: string;
  chatId: () => string;
  sendTelegram: SendTelegramFn;
}) {
  let sessionId: string | undefined;
  const queue: QueuedMessage[] = [];
  let processing = false;

  // MCP server for Bland AI API calls (auth handled by the server)
  const blandMcpServer = createBlandMcpServer(process.env.BLAND_API_KEY);

  // MCP server with send_telegram_message tool
  const telegramMcpServer = createSdkMcpServer({
    name: "metabot-tools",
    version: "1.0.0",
    tools: [
      tool(
        "send_telegram_message",
        "Send a message to the user on Telegram. Use this to notify the user about call outcomes, webhook events, or to ask for input.",
        {
          text: z.string().describe("The message text to send to the user"),
        },
        async (args) => {
          const chatId = config.chatId();
          if (!chatId) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: No Telegram chat ID available yet. The user hasn't messaged the bot.",
                },
              ],
            };
          }
          try {
            await config.sendTelegram(chatId, args.text);
            return {
              content: [
                { type: "text" as const, text: "Message sent successfully." },
              ],
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Failed to send Telegram message: ${msg}`,
                },
              ],
            };
          }
        }
      ),
    ],
  });

  function ts() {
    return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  }

  function logMessage(message: SDKMessage) {
    if (message.type === "system" && "subtype" in message) {
      if (message.subtype === "init" && "session_id" in message) {
        sessionId = message.session_id as string;
        console.log(`[${ts()}] [agent] session=${sessionId}`);
      }
      return;
    }

    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "thinking") {
          const preview = block.thinking?.slice(0, 120).replace(/\n/g, " ") ?? "";
          console.log(`[${ts()}] [agent] 💭 thinking: ${preview}${preview.length >= 120 ? "…" : ""}`);
        } else if (block.type === "text") {
          const preview = block.text.slice(0, 200).replace(/\n/g, " ");
          console.log(`[${ts()}] [agent] 💬 text: ${preview}${block.text.length > 200 ? "…" : ""}`);
        } else if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown>;
          const previewKeys = ["phone_number", "persona_id", "call_id", "query", "path", "text", "description"];
          const highlight = previewKeys
            .filter((k) => k in input)
            .map((k) => `${k}=${JSON.stringify(String(input[k]).slice(0, 80))}`)
            .join(", ");
          const fallback = highlight || JSON.stringify(input).slice(0, 120);
          console.log(`[${ts()}] [agent] 🔧 tool_use: ${block.name}(${fallback})`);
        }
      }
      if (message.error) {
        console.warn(`[${ts()}] [agent] ⚠️  assistant error: ${message.error}`);
      }
      return;
    }

    if (message.type === "result") {
      const r = message as { subtype: string; duration_ms: number; num_turns: number; stop_reason: string | null; is_error: boolean; result?: string; errors?: string[] };
      if (r.is_error) {
        console.error(`[${ts()}] [agent] ❌ result: ${r.subtype} | turns=${r.num_turns} | ${r.duration_ms}ms`);
        if (r.errors?.length) console.error(`[${ts()}] [agent]    errors: ${r.errors.join("; ")}`);
      } else {
        const summary = r.result ? ` | "${r.result.slice(0, 80).replace(/\n/g, " ")}"` : "";
        console.log(`[${ts()}] [agent] ✅ done | turns=${r.num_turns} | ${r.duration_ms}ms | stop=${r.stop_reason}${summary}`);
      }
    }
  }

  async function processMessage(content: string) {
    const preview = content.slice(0, 120).replace(/\n/g, " ");
    console.log(`[${ts()}] [agent] ▶ input: ${preview}${content.length > 120 ? "…" : ""}`);

    for await (const message of query({
      prompt: content,
      options: {
        cwd: config.skillsDir,
        env: {
          ...process.env,
          BLAND_API_KEY: process.env.BLAND_API_KEY,
        },
        systemPrompt: {
          type: "preset",
          preset: "claude_code",
          append: METABOT_INSTRUCTIONS,
        },
        settingSources: ["project"],
        mcpServers: {
          "metabot-tools": telegramMcpServer,
          "bland": blandMcpServer,
        },
        allowedTools: [
          "Read",
          "Glob",
          "Grep",
          "mcp__metabot-tools__send_telegram_message",
          "mcp__bland__bland_call_send",
          "mcp__bland__bland_call_list",
          "mcp__bland__bland_call_get",
          "mcp__bland__bland_call_stop",
          "mcp__bland__bland_call_stop_all",
          "mcp__bland__bland_call_active",
          "mcp__bland__bland_persona_list",
          "mcp__bland__bland_persona_get",
          "mcp__bland__bland_persona_create",
          "mcp__bland__bland_persona_update",
          "mcp__bland__bland_persona_delete",
          "mcp__bland__bland_persona_promote",
          "mcp__bland__bland_pathway_list",
          "mcp__bland__bland_pathway_get",
          "mcp__bland__bland_pathway_create",
          "mcp__bland__bland_pathway_chat",
          "mcp__bland__bland_pathway_node_test",
          "mcp__bland__bland_number_list",
          "mcp__bland__bland_number_buy",
          "mcp__bland__bland_voice_list",
          "mcp__bland__bland_tool_test",
          "mcp__bland__bland_knowledge_list",
          "mcp__bland__bland_knowledge_create",
          "mcp__bland__bland_knowledge_get",
          "mcp__bland__bland_knowledge_delete",
          "mcp__bland__bland_sms_send",
          "mcp__bland__bland_audio_generate",
        ],
        model: "opus",
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        ...(sessionId ? { resume: sessionId } : {}),
      },
    })) {
      logMessage(message);
    }
  }

  async function drainQueue() {
    if (processing) return;
    processing = true;

    try {
      while (queue.length > 0) {
        const msg = queue.shift()!;
        try {
          await processMessage(msg.content);
        } catch (err) {
          console.error("[agent] Error processing message:", err);
          // Try to notify user of error
          const chatId = config.chatId();
          if (chatId) {
            try {
              await config.sendTelegram(
                chatId,
                "Something went wrong processing that. Please try again."
              );
            } catch {}
          }
        }
      }
    } finally {
      processing = false;
    }
  }

  return {
    enqueue(content: string) {
      queue.push({ content });
      drainQueue(); // Fire and forget — drainQueue handles serialization
    },
    reset() {
      sessionId = undefined;
      queue.length = 0;
      processing = false;
      console.log("[agent] Session reset.");
    },
  };
}
