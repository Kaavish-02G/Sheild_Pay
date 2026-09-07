import scenariosFile from "./test-cards.json";

export type TestCardScenario = (typeof scenariosFile.scenarios)[number];

export const TEST_CARD_SCENARIOS: TestCardScenario[] = scenariosFile.scenarios;

export function cardDigits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function lookupTestCardScenario(cardNumber: unknown): TestCardScenario | null {
  const digits = cardDigits(cardNumber);
  if (digits.length < 12) return null;
  const last4 = digits.slice(-4);
  return (
    TEST_CARD_SCENARIOS.find((scenario) => scenario.pans.includes(digits)) ??
    TEST_CARD_SCENARIOS.find((scenario) => scenario.last4 === last4) ??
    null
  );
}

export function inferCardNetwork(
  cardNumber: unknown,
  fallback: string = "visa"
): "visa" | "mastercard" | "amex" | "rupay" | string {
  const digits = cardDigits(cardNumber);
  if (digits.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard";
  if (/^3[47]/.test(digits)) return "amex";
  if (/^(60|65|81|82)/.test(digits)) return "rupay";
  return fallback;
}

export function validateCheckoutCard(input: {
  cardNumber?: unknown;
  expMonth?: unknown;
  expYear?: unknown;
  cvc?: unknown;
}): string | null {
  const digits = cardDigits(input.cardNumber);
  if (digits.length < 12 || digits.length > 19) {
    return "Enter a card number (12–19 digits).";
  }
  const month = Number(input.expMonth);
  const yearRaw = Number(input.expYear);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "Enter a valid expiry month.";
  }
  const now = new Date();
  const exp = new Date(year, month - 1, 1);
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!Number.isInteger(year) || year < 2000 || exp < current) {
    return "Card is expired.";
  }
  const cvc = cardDigits(input.cvc);
  if (cvc.length < 3 || cvc.length > 4) {
    return "Enter a 3- or 4-digit CVC.";
  }
  return null;
}

export function formatCardNumber(value: string): string {
  const digits = cardDigits(value).slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}
