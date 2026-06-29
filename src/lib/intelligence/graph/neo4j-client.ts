/** ponytail: Phase 7 stub — same traverse interface, Neo4j not wired yet */
import type { GraphRetrievalResult } from "../types";
import { traverseGraphForConditions as traversePostgres } from "./traverse";

export async function traverseGraph(
  conditions: string[],
  intents: string[] = [],
  options?: { familyId?: string; weekStart?: string },
): Promise<GraphRetrievalResult> {
  void options;
  return traversePostgres(conditions, intents, options);
}

export function isNeo4jEnabled(): boolean {
  return !!(process.env.NEO4J_URI && process.env.NEO4J_PASSWORD);
}
