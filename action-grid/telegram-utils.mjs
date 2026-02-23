export async function sendTelegramMessage(text, chatIdOverride = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chatIdOverride ?? process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function getTelegramUpdates(offset = null, timeoutSeconds = 0) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return [];

  const payload = {
    timeout: timeoutSeconds,
    allowed_updates: ["message"],
  };
  if (offset != null) payload.offset = offset;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return [];

    const json = await resp.json();
    if (!json?.ok || !Array.isArray(json.result)) return [];
    return json.result;
  } catch {
    return [];
  }
}
