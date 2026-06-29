/** ponytail: hash-based stub embedding when Gemini unavailable offline */
export function embedText(text: string, dims = 8): number[] {
  const vec = new Array(dims).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dims] += text.charCodeAt(i) / 1000;
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / mag);
}

export async function embedTextGemini(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch {
    return null;
  }
}

export async function embedProduct(product: {
  nameEn: string;
  category: string;
  tags: { tag: string }[];
}): Promise<number[]> {
  const text = `${product.nameEn} ${product.category} ${product.tags.map((t) => t.tag).join(" ")}`;
  return (await embedTextGemini(text)) ?? embedText(text);
}
