import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createBot } from "./telegram.js";
import { createWebhookRouter } from "./webhook.js";
import { createAgent } from "./agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Validate required env vars
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BLAND_API_KEY = process.env.BLAND_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!BLAND_API_KEY) throw new Error("BLAND_API_KEY is required");
if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");

const PORT = parseInt(process.env.PORT || "3000", 10);
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Skills directory is the repo root (parent of demo/)
const skillsDir = path.resolve(__dirname, "../..");

// 1. Create Telegram bot
const bot = createBot(
  { token: TELEGRAM_BOT_TOKEN, allowedChatId: TELEGRAM_CHAT_ID },
  (chatId, text) => {
    agent.enqueue(text);
  },
  () => agent.reset()
);

// 2. Create agent
const agent = createAgent({
  skillsDir,
  chatId: () => bot.getChatId(),
  sendTelegram: (chatId, text) => bot.sendMessage(chatId, text),
});

// 3. Create Express app with webhook routes
const app = express();
const webhookRouter = createWebhookRouter((payload) => {
  agent.enqueue(`WEBHOOK RECEIVED:\n${JSON.stringify(payload, null, 2)}`);
});
app.use(webhookRouter);

// 4. Start everything
bot.start();
app.listen(PORT, () => {
  console.log(`[server] Metabot demo running on port ${PORT}`);
  console.log(`[server] Webhook endpoint: POST http://localhost:${PORT}/webhook`);
  console.log(`[server] Health check: GET http://localhost:${PORT}/health`);
  console.log(`[server] Skills directory: ${skillsDir}`);
});
