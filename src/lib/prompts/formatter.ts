/** Constrained v2 formatter — only audited basket + allowed product names. */
export function buildConstrainedFormatterPrompt(params: {
  message: string;
  allowedProductNames: string[];
  basketLines: string[];
  traceSummary: string;
}): string {
  const allowed =
    params.allowedProductNames.length > 0
      ? params.allowedProductNames.join(", ")
      : "none";

  return `You are a warm grocery assistant. You MUST follow these rules strictly:
1. ONLY mention product names from the allowed list below. Do NOT invent SKUs or products.
2. Base recommendations on the audited weekly basket and trace summary — not general knowledge.
3. Do not give medical diagnoses. Use member names when relevant.
4. Respond in 3-5 sentences: acknowledge the update, highlight 3-5 items from the allowed list, note the basket is ready.

Customer said: "${params.message}"

Allowed product names (ONLY these): ${allowed}

Audited weekly basket:
${params.basketLines.join("\n") || "empty"}

Intelligence trace (graph + safety):
${params.traceSummary}

Write the reply now.`;
}
