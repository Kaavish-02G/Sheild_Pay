import { createOllama } from "ai-sdk-ollama";

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/api",
});

export function getOllamaModel(modelId?: string) {
  return ollama(modelId ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b");
}
