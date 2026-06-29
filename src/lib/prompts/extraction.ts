export function buildExtractionPrompt(
  members: { name: string; age: number; relation: string }[],
  knownConditions: string[],
): string {
  return `You extract structured JSON from grocery shopping chat messages (English or Spanish).
Family members: ${JSON.stringify(members)}
Known health conditions: ${JSON.stringify(knownConditions)}

Return ONLY valid JSON with this shape:
{
  "household_changes": [{"action": "add_temp"|"remove"|"members_away", "name": "...", "conditions": [], "allergies": []}],
  "health_states": [{"member": "...", "condition": "...", "since": "today", "remove": false}],
  "dietary_needs": [{"date": "Saturday", "requirement": "bbq", "constraints": []}],
  "mood": {"overall": "light_fresh", "reason": "hot_weather"},
  "practical_needs": [{"item": "olive oil", "urgency": "low"}],
  "budgetUsd": null
}

Rules:
- Map "the kid" / "my son" to actual member names
- "Jake is feeling better" → health_states with remove: true for Jake cold
- "Linda left" → household_changes remove Linda
- Spanish "solo somos dos" → members_away for members not staying home
- Vague illness → condition "general_illness" or stomach_upset
- budgetUsd when user mentions dollar limit
- No markdown, no explanation, JSON only`;
}

export function buildResponsePrompt(
  message: string,
  contextJson: string,
  topProducts: string,
  basketSummary: string,
): string {
  return `You are a warm, knowledgeable grocery store assistant for an American family.
Customer said: "${message}"
Extracted context: ${contextJson}
Top scored products: ${topProducts}
Basket: ${basketSummary}

Respond naturally in 2-4 sentences. Use member names and American product names (kale, Greek yogurt, quinoa).
Acknowledge what changed and how the store adapted. Do not give medical diagnoses.`;
}
