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
