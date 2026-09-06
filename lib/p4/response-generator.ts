import { generateText } from "ai";
import { createOllama } from "ai-sdk-ollama";
import type { VerifiedEvidencePackage } from "@/shared/schemas";

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
});

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

function useFastResponseMode(): boolean {
  return process.env.P4_LIVE_FAST_MODE !== "false";
}

function buildEvidencePrompt(evidence: VerifiedEvidencePackage): string {
  const evidenceLines = evidence.evidence
    .map((field) => `- ${field.label}: ${field.value}`)
    .join("\n");

  return `You are a professional dispute response writer for an e-commerce merchant.

Write a submission-ready dispute response paragraph (3-6 sentences) for the following chargeback.

DISPUTE REASON: ${evidence.disputeReason}

VERIFIED EVIDENCE (use ONLY these facts — do NOT invent dates, amounts, tracking numbers, or claims not listed below):
${evidenceLines || "(no verified evidence fields available)"}

STRICT RULES:
1. Use ONLY the evidence listed above. Do not add any facts, dates, amounts, or claims not present in the evidence.
2. Reference specific evidence fields when making your case.
3. Write in a professional, factual tone suitable for submission to a payment processor.
4. Output only the response paragraph — no headings, bullet points, or meta-commentary.
5. Keep the response between 3 and 6 sentences.`;
}

/** Evidence-only template — never invents facts not in the verified evidence list. */
export function buildEvidenceOnlyResponse(evidence: VerifiedEvidencePackage): string {
  if (evidence.evidence.length === 0) {
    return "We cannot submit a complete dispute response because verified evidence has not been collected yet.";
  }

  const facts = evidence.evidence.map((field) => `${field.label}: ${field.value}`);
  const orderField = evidence.evidence.find((field) => field.key === "order_id");
  const orderRef = orderField?.value ?? "this order";

  return (
    `We respectfully dispute the chargeback regarding order ${orderRef}. ` +
    `Our verified records show the following: ${facts.join("; ")}. ` +
    `This evidence supports that the transaction was valid and fulfilled in accordance with our records. ` +
    `We request that this dispute be resolved in the merchant's favor based solely on the verified evidence above.`
  );
}

export async function generateDisputeResponse(
  evidence: VerifiedEvidencePackage
): Promise<string> {
  if (useFastResponseMode()) {
    return buildEvidenceOnlyResponse(evidence);
  }

  const prompt = buildEvidencePrompt(evidence);

  try {
    const { text } = await generateText({
      model: ollama(OLLAMA_MODEL),
      prompt,
    });

    const trimmed = text.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } catch (error) {
    console.warn(
      "[P4] Ollama response generation failed — using evidence-only template",
      error instanceof Error ? error.message : error
    );
  }

  return buildEvidenceOnlyResponse(evidence);
}
