/** Golden scenario definitions for Intelligence v2 parity testing */
export interface GoldenScenario {
  id: string;
  description: string;
  message?: string;
  expectations: string[];
}

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    id: "johnson-core",
    description: "Mike diabetes+cholesterol, Jake peanut allergy",
    expectations: ["no peanut-tagged SKUs in basket", "low_glycemic boost for Mike"],
  },
  {
    id: "johnson-linda-celiac",
    description: "Linda visiting with celiac",
    message: "My mom Linda is visiting and she can't eat gluten.",
    expectations: ["zero contains_gluten in basket"],
  },
  {
    id: "jake-cold-lifecycle",
    description: "Jake cold boost then remove revert",
    message: "Jake has a cold",
    expectations: ["hydrating/vitamin_c tags boosted", "remove:true reverts cold"],
  },
  {
    id: "vegetarian-member",
    description: "Vegetarian member excludes non_vegetarian",
    expectations: ["zero non_vegetarian tagged products"],
  },
  {
    id: "budget-400",
    description: "Budget trim under $400",
    message: "Keep it under $400",
    expectations: ["totalPrice <= 400", "coverageTradeoff present"],
  },
  {
    id: "spanish-intent",
    description: "Spanish household size intent",
    message: "somos dos esta semana",
    expectations: ["Sarah and Jake members_away"],
  },
  {
    id: "normalization-landmine",
    description: "High-sodium junk must not outrank lentils for diabetic household",
    expectations: ["lentils rank above high-sodium snacks for diabetes"],
  },
  {
    id: "allergy-zero-tolerance",
    description: "Peanut allergy family",
    expectations: ["zero peanut-tagged SKUs"],
  },
  {
    id: "offline-demo",
    description: "ruleBasedExtract works without API key",
    expectations: ["Johnson regex paths populate health_states"],
  },
  {
    id: "chat-highlights",
    description: "pickChatProductHighlights returns basket qty",
    expectations: ["basketQty on highlights"],
  },
];
