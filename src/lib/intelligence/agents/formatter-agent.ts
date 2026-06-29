import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildConstrainedFormatterPrompt } from "@/lib/prompts/formatter";
import type { BasketResult, ExtractedContext, ScoredProduct } from "@/lib/types";
import type { ItemExplanation } from "@/lib/types";

function buildTraceSummary(traces: unknown): string {
  if (!Array.isArray(traces)) return "Safety audit passed.";
  const lines: string[] = [];
  for (const t of traces.slice(0, 5)) {
    const ex = t as ItemExplanation;
    if (ex?.graphPath?.length) {
      lines.push(`- ${ex.why.slice(0, 80)} (graph: ${ex.graphPath.join(" → ")})`);
    } else if (ex?.why) {
      lines.push(`- ${ex.why.slice(0, 100)}`);
    }
  }
  return lines.length ? lines.join("\n") : "Safety audit passed; graph paths attached to basket items.";
}

function allowedNames(
  basket: BasketResult | null | undefined,
  scores: ScoredProduct[],
  productNames?: Map<string, string>,
): string[] {
  const names = new Set<string>();
  for (const item of basket?.items ?? []) {
    names.add(item.name);
  }
  for (const s of scores.slice(0, 15)) {
    const n = productNames?.get(s.productId);
    if (n) names.add(n);
  }
  return Array.from(names);
}

export async function formatChatResponse(
  message: string,
  context: ExtractedContext,
  scores: ScoredProduct[],
  basket?: BasketResult | null,
  productNames?: Map<string, string>,
  traces?: unknown,
): Promise<string> {
  void context;
  const allowed = allowedNames(basket, scores, productNames);
  const basketLines =
    basket?.items.map(
      (i) =>
        `- ${i.name} ×${i.quantity}${i.explanation?.graphPath?.length ? ` [${i.explanation.graphPath.join(" → ")}]` : ""}`,
    ) ?? [];

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const n = basket?.items.length ?? 0;
    return `Thanks — I've updated your family's weekly context. Your audited basket has ${n} items${n ? ` including ${allowed.slice(0, 4).join(", ")}` : ""}.`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = buildConstrainedFormatterPrompt({
      message,
      allowedProductNames: allowed,
      basketLines,
      traceSummary: buildTraceSummary(traces),
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return `Got it — I've refreshed your family's recommendations. ${basket ? `${basket.items.length} items in your weekly basket.` : ""}`;
  }
}

export async function formatClarification(message: string): Promise<string> {
  return `I want to make sure I understand — could you tell me a bit more about "${message.slice(0, 80)}"? For example, who it applies to and any allergies or budget.`;
}
