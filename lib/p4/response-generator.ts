import { generateText } from "ai";
import { createOllama } from "ai-sdk-ollama";
import type { VerifiedEvidencePackage } from "@/shared/schemas";

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
});

const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1:8b";

function buildEvidencePrompt(evidence: VerifiedEvidencePackage): string {
  const evidenceLines = evidence.evidence
    .map((field) => `- ${field.label}: ${field.value}`)
    .join("\n");

  return `You are a professional dispute response writer for an e-commerce merchant.

Write a submission-ready dispute response paragraph (3-6 sentences) for the following chargeback.

DISPUTE REASON: ${evidence.disputeReason}

VERIFIED EVIDENCE (use ONLY these facts — do NOT invent dates, amounts, tracking numbers, or claims not listed below):
${evidenceLines}

STRICT RULES:
1. Use ONLY the evidence listed above. Do not add any facts, dates, amounts, or claims not present in the evidence.
2. Reference specific evidence fields when making your case.
3. Write in a professional, factual tone suitable for submission to a payment processor.
4. Output only the response paragraph — no headings, bullet points, or meta-commentary.
5. Keep the response between 3 and 6 sentences.`;
}

function buildFallbackResponse(evidence: VerifiedEvidencePackage): string {
  const orderField = evidence.evidence.find((e) => e.key === "order_id");
  const deliveryField = evidence.evidence.find((e) => e.key === "delivery_status");
  const paymentField = evidence.evidence.find((e) => e.key === "payment_status");

  const orderRef = orderField?.value ?? "the order in question";
  const deliveryRef = deliveryField?.value ?? "delivery records on file";
  const paymentRef = paymentField?.value ?? "Payment authorization records";

  return (
    `We respectfully dispute this chargeback regarding ${orderRef}. ` +
    `Our records confirm the transaction was authorized and processed in accordance with the customer's purchase. ` +
    `${paymentRef}. ` +
    `Furthermore, ${deliveryRef}, demonstrating fulfillment to the address on file. ` +
    `Based on the verified evidence gathered, we believe this dispute should be resolved in the merchant's favor.`
  );
}

export async function generateDisputeResponse(
  evidence: VerifiedEvidencePackage
): Promise<string> {
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
      "[P4] Ollama response generation failed — using template fallback",
      error instanceof Error ? error.message : error
    );
  }

  return buildFallbackResponse(evidence);
}
