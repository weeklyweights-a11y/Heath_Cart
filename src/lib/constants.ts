export const COLORS = {
  primary: "#1B5E20",
  primaryDark: "#0D3B0E",
  success: "#4CAF50",
  accent: "#8D6E63",
  cream: "#FFF8E1",
  text: "#5D4037",
  danger: "#E57373",
  warning: "#FFB74D",
} as const;

export const CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Proteins",
  "Grains",
  "Dairy",
  "Pantry",
  "Snacks",
] as const;

export const BADGE_TYPES = [
  "recommended",
  "neutral",
  "limit",
  "avoid",
] as const;

export const TYPE_SCALE = [
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
] as const;
