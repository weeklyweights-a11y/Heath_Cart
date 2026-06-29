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

export interface FamilyMemberDto {
  id: string;
  name: string;
  age: number;
  relation: MemberRelation;
  dietType: DietType;
  conditions: string[];
  allergies: string[];
}

export interface ProductDto {
  id: string;
  nameEn: string;
  category: string;
  price: number;
  imageUrl?: string | null;
}
