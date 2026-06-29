import { prisma } from "@/lib/db";
import type { GraphRetrievalResult, NutrientAxis } from "../types";

const MAX_DEPTH = 3;

const TAG_TO_AXIS: Partial<Record<string, NutrientAxis>> = {
  high_fiber: "fiber",
  high_protein: "protein",
  iron_rich: "iron",
  vitamin_c_rich: "vitaminC",
  calcium_rich: "calcium",
  high_sodium: "sodium",
  high_sugar: "sugar",
  high_saturated_fat: "saturatedFat",
  low_glycemic: "glycemicIndex",
  diabetic_friendly: "glycemicIndex",
};

const traversalCache = new Map<string, GraphRetrievalResult>();

function cacheKey(familyId: string, weekStart: string, conditions: string[], intents: string[]): string {
  return `${familyId}:${weekStart}:${conditions.sort().join(",")}:${intents.sort().join(",")}`;
}

export function clearGraphTraversalCache(familyId?: string): void {
  if (!familyId) {
    traversalCache.clear();
    return;
  }
  for (const k of Array.from(traversalCache.keys())) {
    if (k.startsWith(`${familyId}:`)) traversalCache.delete(k);
  }
}

export async function traverseGraphForConditions(
  conditions: string[],
  intents: string[] = [],
  options?: { familyId?: string; weekStart?: string },
): Promise<GraphRetrievalResult> {
  const key = cacheKey(
    options?.familyId ?? "anon",
    options?.weekStart ?? "none",
    conditions,
    intents,
  );
  const cached = traversalCache.get(key);
  if (cached) return cached;

  const conceptKeys = [
    ...conditions.map((c) => `condition:${c}`),
    ...intents.map((i) => `intent:${i}`),
  ];

  if (conceptKeys.length === 0) {
    const empty: GraphRetrievalResult = {
      requiredTags: new Map(),
      avoidTags: new Set(),
      preferredTags: new Map(),
      nutrientAxisWeights: new Map(),
      graphPaths: [],
    };
    return empty;
  }

  const startNodes = await prisma.kgNode.findMany({
    where: { key: { in: conceptKeys } },
  });

  const edges = await prisma.kgEdge.findMany({
    include: { fromNode: true, toNode: true },
  });

  const edgesByFrom = new Map<string, typeof edges>();
  for (const e of edges) {
    const list = edgesByFrom.get(e.fromNodeId) ?? [];
    list.push(e);
    edgesByFrom.set(e.fromNodeId, list);
  }

  const requiredTags = new Map<string, { weight: number; reason: string; path: string[] }>();
  const avoidTags = new Set<string>();
  const preferredTags = new Map<string, number>();
  const nutrientAxisWeights = new Map<NutrientAxis, number>();
  const graphPaths: GraphRetrievalResult["graphPaths"] = [];

  type QueueItem = { nodeId: string; path: string[]; depth: number };
  const queue: QueueItem[] = startNodes.map((n) => ({
    nodeId: n.id,
    path: [n.label],
    depth: 0,
  }));

  while (queue.length > 0) {
    const { nodeId, path, depth } = queue.shift()!;
    if (depth >= MAX_DEPTH) continue;

    const outEdges = edgesByFrom.get(nodeId) ?? [];
    for (const edge of outEdges) {
      const nextPath = [...path, edge.relation, edge.toNode.label];
      const tagKey =
        edge.toNode.type === "tag" ? edge.toNode.key.replace(/^tag:/, "") : null;

      if (edge.relation === "REQUIRES" && tagKey) {
        const prev = requiredTags.get(tagKey);
        const w = Math.abs(edge.weight);
        if (!prev || w > prev.weight) {
          requiredTags.set(tagKey, {
            weight: w,
            reason: edge.reason ?? edge.toNode.label,
            path: nextPath,
          });
        }
        graphPaths.push({ path: nextPath, reason: edge.reason ?? "", weight: edge.weight });
      }

      if (edge.relation === "AVOIDS" && tagKey) {
        avoidTags.add(tagKey);
        graphPaths.push({ path: nextPath, reason: edge.reason ?? "", weight: edge.weight });
      }

      if (edge.relation === "PREFERS" && tagKey) {
        preferredTags.set(tagKey, (preferredTags.get(tagKey) ?? 0) + edge.weight);
        graphPaths.push({ path: nextPath, reason: edge.reason ?? "", weight: edge.weight });
      }

      if (edge.relation === "SATISFIED_BY" && tagKey) {
        const prev = requiredTags.get(tagKey);
        const w = edge.weight * 0.8;
        if (!prev || w > prev.weight) {
          requiredTags.set(tagKey, {
            weight: w,
            reason: edge.reason ?? "Satisfied by tag match",
            path: nextPath,
          });
        }
      }

      if (edge.relation === "LIMITS") {
        const axis = edge.toNode.key.replace(/^axis:/, "") as NutrientAxis;
        if (axis) {
          nutrientAxisWeights.set(axis, (nutrientAxisWeights.get(axis) ?? 0) + edge.weight);
        }
      }

      if (tagKey && TAG_TO_AXIS[tagKey]) {
        const axis = TAG_TO_AXIS[tagKey]!;
        const sign = edge.relation === "AVOIDS" || edge.relation === "LIMITS" ? -1 : 1;
        nutrientAxisWeights.set(
          axis,
          (nutrientAxisWeights.get(axis) ?? 0) + sign * Math.abs(edge.weight),
        );
      }

      queue.push({ nodeId: edge.toNodeId, path: nextPath, depth: depth + 1 });
    }
  }

  const result: GraphRetrievalResult = {
    requiredTags,
    avoidTags,
    preferredTags,
    nutrientAxisWeights,
    graphPaths,
  };

  traversalCache.set(key, result);
  return result;
}
