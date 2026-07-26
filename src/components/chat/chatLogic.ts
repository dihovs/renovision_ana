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

export function isValidPostalCode(value: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(value.trim());
}
