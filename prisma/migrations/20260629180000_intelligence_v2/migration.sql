-- CreateEnum
CREATE TYPE "KgNodeType" AS ENUM ('clinical_concept', 'nutrient_need', 'nutrient_limit', 'tag', 'intent', 'foodon_term');

-- CreateEnum
CREATE TYPE "KgEdgeRelation" AS ENUM ('REQUIRES', 'AVOIDS', 'SATISFIED_BY', 'PREFERS', 'MAPS_TO', 'LIMITS');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "foodonId" TEXT;

-- AlterTable
ALTER TABLE "ProductScore" ADD COLUMN IF NOT EXISTS "scoreBreakdown" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "KgNode" (
    "id" TEXT NOT NULL,
    "type" "KgNodeType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "KgNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "KgEdge" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "relation" "KgEdgeRelation" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reason" TEXT,
    "source" TEXT,
    CONSTRAINT "KgEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntelligenceRun" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "traceJson" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KgNode_key_key" ON "KgNode"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "KgEdge_fromNodeId_toNodeId_relation_key" ON "KgEdge"("fromNodeId", "toNodeId", "relation");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KgEdge_fromNodeId_idx" ON "KgEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "KgEdge_toNodeId_idx" ON "KgEdge"("toNodeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntelligenceRun_familyId_idx" ON "IntelligenceRun"("familyId");

-- AddForeignKey
ALTER TABLE "KgEdge" DROP CONSTRAINT IF EXISTS "KgEdge_fromNodeId_fkey";
ALTER TABLE "KgEdge" ADD CONSTRAINT "KgEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "KgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KgEdge" DROP CONSTRAINT IF EXISTS "KgEdge_toNodeId_fkey";
ALTER TABLE "KgEdge" ADD CONSTRAINT "KgEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "KgNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntelligenceRun" DROP CONSTRAINT IF EXISTS "IntelligenceRun_familyId_fkey";
ALTER TABLE "IntelligenceRun" ADD CONSTRAINT "IntelligenceRun_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
