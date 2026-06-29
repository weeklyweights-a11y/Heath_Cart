export type HealthBadge = "recommended" | "neutral" | "limit" | "avoid";

export type MemberRelation =
  | "self"
  | "spouse"
  | "child"
  | "parent"
  | "grandparent"
  | "sibling"
  | "other";

export type DietType = "vegetarian" | "non_vegetarian" | "flexible";

export interface ApiResponse<T> {
  data?: T;
  error?: { message: string };
}

export interface HouseholdChange {
  action: "add_temp" | "remove" | "members_away";
  name?: string;
  conditions?: string[];
  allergies?: string[];
}

export interface HealthStateEntry {
  member: string;
  condition: string;
  since?: string;
  remove?: boolean;
}

export interface DietaryNeed {
  date?: string;
  requirement: string;
  constraints?: string[];
}

export interface PracticalNeed {
  item: string;
  urgency?: string;
}

export interface ExtractedContext {
  household_changes: HouseholdChange[];
  membersAway: string[];
  health_states: HealthStateEntry[];
  dietary_needs: DietaryNeed[];
  mood?: { overall: string; reason?: string };
  practical_needs: PracticalNeed[];
  budgetUsd?: number;
}

export function emptyExtractedContext(): ExtractedContext {
  return {
    household_changes: [],
    membersAway: [],
    health_states: [],
    dietary_needs: [],
    practical_needs: [],
  };
}

export interface FamilyMemberDto {
  id: string;
  name: string;
  age: number;
  relation: MemberRelation;
  dietType: DietType;
  conditions: string[];
  allergies: string[];
  heightCm?: number | null;
  weightKg?: number | null;
  isTemporary?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface FamilyDto {
  id: string;
  name: string;
  createdAt: string;
  members: FamilyMemberDto[];
}

export interface ScoredProduct {
  productId: string;
  score: number;
  badge: HealthBadge;
  reasoning: string[];
}

export interface ScoredProductDetail extends ScoredProduct {
  id: string;
  nameEn: string;
  category: string;
  price: number;
  imageUrl?: string | null;
}

export interface BasketVariant {
  variantId: string;
  weightValue: number;
  weightUnit: string;
}

export interface BasketItem {
  productId: string;
  name: string;
  quantity: number;
  variant: BasketVariant;
  price: number;
  reasoning: string;
  membersBenefiting: string[];
}

export interface BasketResult {
  basketId: string;
  items: BasketItem[];
  coverageScore: number;
  perMemberCoverage: Record<string, number>;
  totalPrice: number;
  weeklyContext: string;
  coverageTradeoff?: string;
}

export interface ActiveMember {
  id: string;
  name: string;
  age: number;
  relation: MemberRelation;
  dietType: DietType;
  conditions: string[];
  allergies: string[];
  isTemporary: boolean;
  isAway: boolean;
  effectiveConditions: string[];
}

export interface ProductDto {
  id: string;
  nameEn: string;
  category: string;
  price: number;
  imageUrl?: string | null;
  badge?: HealthBadge;
  reasoning?: string[];
  score?: number;
}

export interface NutrientGaps {
  ironMg: number;
  fiberG: number;
  vitaminCMg: number;
  proteinG: number;
  calciumMg: number;
}
