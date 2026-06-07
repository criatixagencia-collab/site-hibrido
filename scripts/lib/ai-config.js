export function aiApiKey() {
  if (process.env.AI_BASE_URL) return process.env.AI_API_KEY || "";
  return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
}

export function aiBaseUrl() {
  return (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/g, "");
}

export function aiChatCompletionsUrl() {
  return `${aiBaseUrl()}/chat/completions`;
}

export function aiModel(fallback = "gpt-4o-mini") {
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || fallback;
}

export function isOpenAIBaseUrl() {
  return /(^|\.)api\.openai\.com$/i.test(new URL(aiBaseUrl()).hostname);
}
