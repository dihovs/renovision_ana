export type ProjectType = "renovations" | "waterDamage" | "kitchenBath";
export type ProjectSize = "small" | "medium" | "large";
export type QualityTier = "standard" | "premium" | "luxury";

export type ChatStep =
  | "projectType"
  | "size"
  | "tier"
  | "photo"
  | "estimate"
  | "leadCapture"
  | "done";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  imageDataUrl?: string;
};

const PRICING: Record<ProjectType, Record<ProjectSize, [number, number]>> = {
  renovations: {
    small: [5000, 12000],
    medium: [12000, 30000],
    large: [30000, 75000],
  },
  waterDamage: {
    small: [1500, 4000],
    medium: [4000, 12000],
    large: [12000, 30000],
  },
  kitchenBath: {
    small: [8000, 18000],
    medium: [18000, 35000],
    large: [35000, 70000],
  },
};

const TIER_MULTIPLIER: Record<QualityTier, number> = {
  standard: 1,
  premium: 1.3,
  luxury: 1.7,
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function estimateRange(
  type: ProjectType,
  size: ProjectSize,
  tier: QualityTier,
): { low: string; high: string } {
  const [low, high] = PRICING[type][size];
  const multiplier = TIER_MULTIPLIER[tier];
  return {
    low: currencyFormatter.format(Math.round((low * multiplier) / 100) * 100),
    high: currencyFormatter.format(Math.round((high * multiplier) / 100) * 100),
  };
}

const ON_TOPIC_KEYWORDS = [
  "renovat",
  "remodel",
  "kitchen",
  "bath",
  "water",
  "damage",
  "leak",
  "floor",
  "repair",
  "paint",
  "roof",
  "basement",
  "ceiling",
  "mold",
  "flood",
  "plumbing",
  "electrical",
  "insurance",
  "property",
  "tenant",
  "unit",
  "estimate",
  "quote",
  "price",
  "cost",
  "contractor",
  "cabinet",
  "countertop",
  "drywall",
  "restoration",
  "claim",
];

export function isOnTopic(message: string): boolean {
  const lower = message.toLowerCase();
  return ON_TOPIC_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value: string): boolean {
  return value.replace(/[^0-9]/g, "").length >= 7;
}
