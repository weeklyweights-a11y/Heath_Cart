import "./load-env";
import { prisma } from "./prisma-client";

const SYNTHETIC = [
  {
    foodCode: 9000001,
    nameEn: "Mangoes, raw",
    foodGroup: "Fruits",
    energyKcal: 60,
    proteinG: 0.8,
    totalFatG: 0.4,
    carbsG: 15,
    fiberG: 1.6,
    sugarG: 13.7,
    vitaminCMg: 36.4,
    potassiumMg: 168,
  },
  {
    foodCode: 9000002,
    nameEn: "Hot sauce, chili pepper",
    foodGroup: "Spices and Herbs",
    energyKcal: 12,
    proteinG: 0.5,
    carbsG: 2.5,
    fiberG: 0.5,
    sugarG: 0.5,
    sodiumMg: 900,
    vitaminCMg: 4,
  },
  {
    foodCode: 9000003,
    nameEn: "Fish, cod, Atlantic, raw",
    foodGroup: "Finfish and Shellfish Products",
    energyKcal: 82,
    proteinG: 17.8,
    totalFatG: 0.7,
    sodiumMg: 54,
    potassiumMg: 413,
  },
  {
    foodCode: 9000004,
    nameEn: "Rice, jasmine, long-grain, raw",
    foodGroup: "Cereal Grains and Pasta",
    energyKcal: 360,
    proteinG: 7,
    carbsG: 80,
    fiberG: 1.3,
    sugarG: 0.1,
    ironMg: 0.8,
  },
  {
    foodCode: 9000005,
    nameEn: "Mustard, dijon, prepared",
    foodGroup: "Spices and Herbs",
    energyKcal: 120,
    proteinG: 6,
    totalFatG: 5,
    carbsG: 10,
    fiberG: 4,
    sodiumMg: 1100,
  },
];

async function main() {
  for (const row of SYNTHETIC) {
    await prisma.nutritionLookup.upsert({
      where: { foodCode: row.foodCode },
      create: {
        ...row,
        nameHi: null,
        nameTe: null,
        glycemicIndex: null,
      },
      update: row,
    });
  }
  console.log("Synthetic foods:", SYNTHETIC.length);
}

main().finally(() => prisma.$disconnect());
