import type {
  ApiResponse,
  BasketResult,
  ExtractedContext,
  FamilyDto,
  FamilyMemberDto,
  ProductDto,
  ScoredProduct,
  ScoreBreakdown,
} from "./types";

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<{ data?: T; error?: string }> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || json.error) {
    return { error: json.error?.message ?? `Request failed (${res.status})` };
  }
  return { data: json.data };
}

export async function fetchFamily(id: string) {
  return request<FamilyDto>(`/api/family/${id}`);
}

export async function createFamily(name: string) {
  return request<FamilyDto>("/api/family", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export type MemberBody = Omit<FamilyMemberDto, "id">;

export async function addMember(familyId: string, body: MemberBody) {
  return request<FamilyDto>(`/api/family/${familyId}/members`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateMember(
  familyId: string,
  memberId: string,
  body: Partial<MemberBody>,
) {
  return request<FamilyDto>(`/api/family/${familyId}/members/${memberId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteMember(familyId: string, memberId: string) {
  return request<FamilyDto>(`/api/family/${familyId}/members/${memberId}`, {
    method: "DELETE",
  });
}

export async function fetchProducts(params: {
  familyId?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const q = new URLSearchParams();
  if (params.familyId) q.set("familyId", params.familyId);
  if (params.category) q.set("category", params.category);
  if (params.search) q.set("search", params.search);
  q.set("limit", String(params.limit ?? 100));
  if (params.offset) q.set("offset", String(params.offset));
  return request<{ total: number; products: ProductDto[] }>(
    `/api/products?${q}`,
  );
}

export interface ProductDetail extends ProductDto {
  subcategory?: string;
  description?: string | null;
  variants: {
    id: string;
    weightValue: number;
    weightUnit: string;
    price: number;
  }[];
  tags: string[];
  nutrition: Record<string, number | null> | null;
  reasoning?: string[];
  scoreBreakdown?: ScoreBreakdown;
  graphPath?: string[];
}

export async function fetchProduct(id: string, familyId?: string) {
  const q = familyId ? `?familyId=${familyId}` : "";
  return request<ProductDetail>(`/api/products/${id}${q}`);
}

export async function fetchBasket(basketId: string) {
  return request<BasketResult>(`/api/basket/${basketId}`);
}

export interface ChatResponse {
  response: string;
  extractedContext: ExtractedContext;
  updatedScores: ScoredProduct[];
  basket: BasketResult;
  basketId: string;
  explanationTraces?: unknown;
}

export async function sendChat(body: {
  familyId: string;
  message: string;
  budget?: number;
}) {
  return request<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function generateBasket(body: {
  familyId: string;
  budget?: number;
}) {
  return request<BasketResult>("/api/basket", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adjustBasket(body: {
  familyId: string;
  basketId: string;
  adjustments: { productId: string; newQuantity: number | "remove" }[];
}) {
  return request<BasketResult>("/api/basket/adjust", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function addToBasket(body: {
  familyId: string;
  basketId?: string;
  productId: string;
  variantId: string;
  quantity?: number;
}) {
  return request<BasketResult>("/api/basket/add", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function seedJohnsonDemo() {
  return request<{ familyId: string; family: FamilyDto }>(
    "/api/demo/johnson",
    { method: "POST" },
  );
}

/** Creates a minimal household so shop/basket works before full family setup. */
export async function ensureGuestFamily() {
  const { data: family, error } = await createFamily("My household");
  if (!family) return { error: error ?? "Could not create household" };

  const { data: withMember, error: memberError } = await addMember(family.id, {
    name: "You",
    age: 30,
    relation: "self",
    dietType: "flexible",
    conditions: [],
    allergies: [],
  });

  return {
    familyId: family.id,
    family: withMember ?? family,
    error: memberError,
  };
}
