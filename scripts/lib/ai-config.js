export function aiApiKey() {
  return process.env.AI_API_KEY || "";
}

export function aiBaseUrl() {
  return (process.env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/+$/g, "");
}

export function aiChatCompletionsUrl() {
  return `${aiBaseUrl()}/chat/completions`;
}

export function aiModel(fallback = "deepseek-chat") {
  return process.env.AI_MODEL || fallback;
}

export function isOpenAIBaseUrl() {
  return /(^|\.)api\.openai\.com$/i.test(new URL(aiBaseUrl()).hostname);
}
