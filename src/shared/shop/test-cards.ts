export const formatCardNumber = (v: string) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
export function inferCardNetwork(v: string, fallback = 'visa') { const n = v.replace(/\D/g, ''); if (/^3[47]/.test(n)) return 'amex'; if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard'; if (/^(60|65|81|82)/.test(n)) return 'rupay'; if (/^4/.test(n)) return 'visa'; return fallback; }
export const testCards: Record<string, string> = { visa: '4242424242424242', mastercard: '5555555555554444', amex: '378282246310005', rupay: '6521000000000000' };
