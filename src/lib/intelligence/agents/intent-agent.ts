import { extractContext, ruleBasedExtract } from "@/lib/ai";
import type { ExtractedContext, FamilyMemberDto } from "@/lib/types";
import type { RefinedIntent } from "../types";

export function refineIntent(
  extracted: ExtractedContext,
  confidence: number,
): RefinedIntent {
  const hardAllergies: string[] = [];
  const hardAvoids: string[] = [];

  for (const hc of extracted.household_changes) {
    if (hc.allergies) hardAllergies.push(...hc.allergies);
    if (hc.conditions?.includes("celiac")) hardAvoids.push("contains_gluten");
  }

  return {
    hard: { allergies: hardAllergies, avoids: hardAvoids },
    soft: {
      mood: extracted.mood?.overall,
      dietaryNeeds: extracted.dietary_needs.map((d) => d.requirement),
      budgetUsd: extracted.budgetUsd,
    },
    householdChanges: extracted.household_changes,
    healthStates: extracted.health_states,
    confidence,
  };
}

export async function parseIntent(
  message: string,
  members: FamilyMemberDto[],
): Promise<{ extracted: ExtractedContext; refined: RefinedIntent }> {
  const hasApiKey = !!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY);
  let extracted: ExtractedContext;
  let confidence = hasApiKey ? 0.85 : 0.55;

  if (!hasApiKey) {
    extracted = ruleBasedExtract(message, members);
    confidence = 0.7;
  } else {
    extracted = await extractContext(message, members);
    const ruleFallback = ruleBasedExtract(message, members);
    if (
      extracted.health_states.length === 0 &&
      ruleFallback.health_states.length > 0
    ) {
      extracted = { ...extracted, health_states: ruleFallback.health_states };
      confidence = 0.65;
    }
  }

  if (confidence < 0.6 && !hasApiKey) {
    extracted = ruleBasedExtract(message, members);
    confidence = 0.7;
  }

  return { extracted, refined: refineIntent(extracted, confidence) };
}
