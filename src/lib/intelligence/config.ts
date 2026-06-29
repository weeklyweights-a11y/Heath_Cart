/** Feature flag: Intelligence v2 graph + cosine scoring + CSP basket. */
export function isIntelligenceV2Enabled(): boolean {
  const v = process.env.INTELLIGENCE_V2?.toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  // v2 is production default; set INTELLIGENCE_V2=false to revert to v1
  return true;
}

export function isPgVectorEnabled(): boolean {
  const v = process.env.PGVECTOR_ENABLED?.toLowerCase();
  if (v === "false" || v === "0") return false;
  return v === "true" || v === "1";
}
