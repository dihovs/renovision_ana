export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  imageDataUrl?: string;
};

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value: string): boolean {
  return value.replace(/[^0-9]/g, "").length >= 7;
}

// Canadian postal codes never use the letters D, F, I, O, Q, or U, so an "O"
// or "I" typed where a digit belongs is unambiguously a mistyped 0 or 1 —
// people read "H7T 0C6" off a bill and type the letter. Normalizing here
// rather than rejecting avoids a dead-looking disabled button.
export function normalizePostalCode(value: string): string {
  const chars = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).split("");
  const digitPositions = [1, 3, 5];
  for (const i of digitPositions) {
    if (chars[i] === "O") chars[i] = "0";
    else if (chars[i] === "I") chars[i] = "1";
  }
  const joined = chars.join("");
  return joined.length > 3 ? `${joined.slice(0, 3)} ${joined.slice(3)}` : joined;
}

export function isValidPostalCode(value: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(normalizePostalCode(value));
}
