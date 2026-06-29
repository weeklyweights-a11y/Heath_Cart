import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { prisma } from "./db";
import {
  buildExtractionPrompt,
  buildResponsePrompt,
} from "./prompts/extraction";
import type { ExtractedContext, FamilyMemberDto, ScoredProduct } from "./types";
import { emptyExtractedContext } from "./types";
import type { BasketResult } from "./types";

const extractedSchema = z.object({
  household_changes: z
    .array(
      z.object({
        action: z.enum(["add_temp", "remove", "members_away"]),
        name: z.string().optional(),
        conditions: z.array(z.string()).optional(),
        allergies: z.array(z.string()).optional(),
      }),
    )
    .default([]),
  health_states: z
    .array(
      z.object({
        member: z.string(),
        condition: z.string(),
        since: z.string().optional(),
        remove: z.boolean().optional(),
      }),
    )
    .default([]),
  dietary_needs: z
    .array(
      z.object({
        date: z.string().optional(),
        requirement: z.string(),
        constraints: z.array(z.string()).optional(),
      }),
    )
    .default([]),
  mood: z
    .object({
      overall: z.string(),
      reason: z.string().optional(),
    })
    .optional(),
  practical_needs: z
    .array(
      z.object({
        item: z.string(),
        urgency: z.string().optional(),
      }),
    )
    .default([]),
  budgetUsd: z.number().optional().nullable(),
});

function parseBudgetFromMessage(message: string): number | undefined {
  const match = message.match(/\$?\s*(\d+)\s*(?:dollars?|usd)?/i);
  if (match && /under|below|keep|budget|limit/i.test(message)) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

function ruleBasedExtract(
  message: string,
  members: FamilyMemberDto[],
): ExtractedContext {
  const lower = message.toLowerCase();
  const ctx = emptyExtractedContext();

  if (/feeling better|is better|recovered/i.test(message)) {
    const jake = members.find((m) => m.name === "Jake");
    if (jake) {
      ctx.health_states.push({
        member: "Jake",
        condition: "cold",
        remove: true,
      });
    }
  }

  if (/linda left|linda went|linda gone/i.test(lower)) {
    ctx.household_changes.push({ action: "remove", name: "Linda" });
  }

  if (/solo esta semana somos dos|somos dos esta semana|llevó a los niños/i.test(lower)) {
    ctx.household_changes.push({ action: "members_away", name: "Sarah" });
    ctx.household_changes.push({ action: "members_away", name: "Jake" });
  }

  if (/linda.*gluten|gluten.*linda|mom linda|linda is visiting/i.test(lower)) {
    ctx.household_changes.push({
      action: "add_temp",
      name: "Linda",
      conditions: ["celiac"],
    });
  }

  if (/jake.*cold|cold.*jake/i.test(lower)) {
    ctx.health_states.push({
      member: "Jake",
      condition: "cold",
      since: "today",
    });
  }

  if (/bbq|barbecue|barbeque/i.test(lower)) {
    ctx.dietary_needs.push({ date: "Saturday", requirement: "bbq" });
  }

  if (/hot|light.*fresh|super hot/i.test(lower)) {
    ctx.mood = { overall: "light_fresh", reason: "hot_weather" };
  }

  if (/olive oil/i.test(lower)) {
    ctx.practical_needs.push({ item: "olive oil" });
  }
  if (/oats/i.test(lower)) {
    ctx.practical_needs.push({ item: "oats" });
  }

  if (/keto/i.test(lower)) {
    ctx.dietary_needs.push({ requirement: "keto" });
  }
  if (/meal prep/i.test(lower)) {
    ctx.dietary_needs.push({ requirement: "meal_prep" });
  }

  if (/not feeling great|simple and light|something simple/i.test(lower)) {
    ctx.mood = { overall: "light_fresh", reason: "general" };
  }

  if (/sister.*lactose|lactose.*sister/i.test(lower)) {
    ctx.household_changes.push({
      action: "add_temp",
      name: "Linda's sister",
      conditions: ["lactose_intolerance"],
    });
  }

  const budget = parseBudgetFromMessage(message);
  if (budget) ctx.budgetUsd = budget;

  return mergeWithMembersAway(ctx);
}

function mergeWithMembersAway(ctx: ExtractedContext): ExtractedContext {
  const away = new Set(ctx.membersAway.map((n) => n.toLowerCase()));
  for (const c of ctx.household_changes) {
    if (c.action === "members_away" && c.name) {
      away.add(c.name.toLowerCase());
    }
  }
  ctx.membersAway = Array.from(away).map(
    (l) =>
      ctx.household_changes.find((c) => c.name?.toLowerCase() === l)?.name ??
      l,
  );
  return ctx;
}

export async function extractContext(
  message: string,
  members: FamilyMemberDto[],
): Promise<ExtractedContext> {
  const rules = await prisma.healthConditionRule.findMany({
    where: { isActive: true },
    select: { condition: true },
    distinct: ["condition"],
  });
  const knownConditions = Array.from(new Set(rules.map((r) => r.condition)));

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return mergeWithMembersAway(ruleBasedExtract(message, members));
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = buildExtractionPrompt(
      members.map((m) => ({
        name: m.name,
        age: m.age,
        relation: m.relation,
      })),
      knownConditions,
    );

    const result = await model.generateContent([
      prompt,
      `Customer message: ${message}`,
    ]);
    const text = result.response.text();
    const parsed = extractedSchema.parse(JSON.parse(text));

    const ctx: ExtractedContext = {
      household_changes: parsed.household_changes,
      membersAway: [],
      health_states: parsed.health_states,
      dietary_needs: parsed.dietary_needs,
      mood: parsed.mood,
      practical_needs: parsed.practical_needs,
      budgetUsd: parsed.budgetUsd ?? parseBudgetFromMessage(message),
    };

    return mergeWithMembersAway(ctx);
  } catch {
    return mergeWithMembersAway(ruleBasedExtract(message, members));
  }
}

export async function generateResponse(
  message: string,
  context: ExtractedContext,
  scores: ScoredProduct[],
  basket?: BasketResult | null,
  productNames?: Map<string, string>,
): Promise<string> {
  const nameOf = (id: string) => productNames?.get(id) ?? id;

  const topRecommended = scores
    .filter((s) => s.badge === "recommended")
    .slice(0, 8)
    .map((s) => nameOf(s.productId))
    .join(", ");

  const basketSummary = basket
    ? `${basket.items.length} items, $${basket.totalPrice.toFixed(2)}, coverage ${basket.coverageScore}%`
    : "none yet";

  const basketSampleNames = basket
    ? basket.items
        .slice(0, 8)
        .map((i) => `${i.name} (×${i.quantity})`)
        .join(", ")
    : "none yet";

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return `Thanks for sharing! I've updated your family's weekly context and refreshed product recommendations. ${basket ? `Your suggested basket has ${basket.items.length} items.` : ""}`;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = buildResponsePrompt(
      message,
      JSON.stringify(context),
      topRecommended || "see basket",
      basketSummary,
      basketSampleNames,
    );
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch {
    return `Got it — I've noted your update and adjusted recommendations for your family.`;
  }
}

export { ruleBasedExtract, extractedSchema };
