import { Bot } from "grammy";

export interface TelegramConfig {
  token: string;
  allowedChatId?: string;
}

export function createBot(
  config: TelegramConfig,
  onMessage: (chatId: string, text: string) => void,
  onReset?: () => void
) {
  const bot = new Bot(config.token);
  let resolvedChatId = config.allowedChatId || "";

  bot.on("message:text", (ctx) => {
    const chatId = String(ctx.chat.id);

    // Lock to first sender if no TELEGRAM_CHAT_ID configured
    if (!resolvedChatId) {
      resolvedChatId = chatId;
      console.log(`[telegram] Locked to chat ID: ${chatId}`);
    }

    if (chatId !== resolvedChatId) {
      console.log(`[telegram] Ignoring message from unauthorized chat: ${chatId}`);
      return;
    }

    const text = ctx.message.text;
    console.log(`[telegram] Received: ${text}`);

    if (text === "/reset") {
      onReset?.();
      ctx.reply("Session reset. Starting fresh.").catch(() => {});
      return;
    }

    onMessage(chatId, text);
  });

  bot.catch((err) => {
    console.error("[telegram] Bot error:", err);
  });

  return {
    start: () => {
      bot.start();
      console.log("[telegram] Bot started (long-polling)");
    },
    sendMessage: async (chatId: string, text: string) => {
      await bot.api.sendMessage(chatId, text);
      console.log(`[telegram] Sent message to ${chatId}`);
    },
    getChatId: () => resolvedChatId,
  };
}
