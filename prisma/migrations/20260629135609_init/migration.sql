-- CreateEnum
CREATE TYPE "HealthAction" AS ENUM ('boost', 'limit', 'avoid');

-- CreateEnum
CREATE TYPE "MemberRelation" AS ENUM ('self', 'spouse', 'child', 'parent', 'grandparent', 'sibling', 'other');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('vegetarian', 'non_vegetarian', 'flexible');

-- CreateEnum
CREATE TYPE "HealthBadge" AS ENUM ('recommended', 'neutral', 'limit', 'avoid');

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "relation" "MemberRelation" NOT NULL,
    "dietType" "DietType" NOT NULL,
    "conditions" TEXT[],
    "allergies" TEXT[],
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "isTemporary" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyContext" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "extractedContext" JSONB NOT NULL,
    "cuisineMood" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionLookup" (
    "foodCode" INTEGER NOT NULL,
    "foodGroup" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameHi" TEXT,
    "nameTe" TEXT,
    "energyKcal" DOUBLE PRECISION,
    "proteinG" DOUBLE PRECISION,
    "totalFatG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fiberG" DOUBLE PRECISION,
    "sugarG" DOUBLE PRECISION,
    "ironMg" DOUBLE PRECISION,
    "calciumMg" DOUBLE PRECISION,
    "vitaminAUg" DOUBLE PRECISION,
    "vitaminCMg" DOUBLE PRECISION,
    "folateMg" DOUBLE PRECISION,
    "potassiumMg" DOUBLE PRECISION,
    "sodiumMg" DOUBLE PRECISION,
    "saturatedFatG" DOUBLE PRECISION,
    "magnesiumMg" DOUBLE PRECISION,
    "glycemicIndex" DOUBLE PRECISION,

    CONSTRAINT "NutritionLookup_pkey" PRIMARY KEY ("foodCode")
);

-- CreateTable
CREATE TABLE "HealthConditionRule" (
    "id" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "action" "HealthAction" NOT NULL,
    "targetTag" TEXT NOT NULL,
    "scoreImpact" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "autoExpireDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HealthConditionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaryTagRule" (
    "id" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "nutrientColumn" TEXT,
    "operator" TEXT,
    "threshold" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DietaryTagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTe" TEXT,
    "description" TEXT,
    "usdaFoodCode" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isSeasonal" BOOLEAN NOT NULL DEFAULT false,
    "availableMonths" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "weightValue" DOUBLE PRECISION NOT NULL,
    "weightUnit" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "sku" TEXT,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietaryTag" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "DietaryTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductScore" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "badge" "HealthBadge" NOT NULL,
    "reasoning" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasketRecommendation" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "basketJson" JSONB NOT NULL,
    "coverageScore" DOUBLE PRECISION NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasketRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyContext_familyId_weekStart_key" ON "WeeklyContext"("familyId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "HealthConditionRule_condition_action_targetTag_key" ON "HealthConditionRule"("condition", "action", "targetTag");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTagRule_tagName_key" ON "DietaryTagRule"("tagName");

-- CreateIndex
CREATE UNIQUE INDEX "Product_nameEn_category_key" ON "Product"("nameEn", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_weightValue_weightUnit_key" ON "ProductVariant"("productId", "weightValue", "weightUnit");

-- CreateIndex
CREATE UNIQUE INDEX "DietaryTag_productId_tag_key" ON "DietaryTag"("productId", "tag");

-- CreateIndex
CREATE INDEX "ProductScore_familyId_idx" ON "ProductScore"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductScore_familyId_productId_key" ON "ProductScore"("familyId", "productId");

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyContext" ADD CONSTRAINT "WeeklyContext_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_usdaFoodCode_fkey" FOREIGN KEY ("usdaFoodCode") REFERENCES "NutritionLookup"("foodCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DietaryTag" ADD CONSTRAINT "DietaryTag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductScore" ADD CONSTRAINT "ProductScore_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductScore" ADD CONSTRAINT "ProductScore_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasketRecommendation" ADD CONSTRAINT "BasketRecommendation_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
