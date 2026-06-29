import { describe, it, expect } from "vitest";
import {
  buildProductVector,
  buildIdealVector,
  vectorMagnitude,
  emptyVector,
} from "../ranking/nutrient-vector";
import { cosineSimilarity } from "../ranking/cosine-rank";

describe("normalization landmine       ", () => {
  const weeklyRda = {
    ironMg: 56,
    fiberG: 28,
    vitaminCMg: 630,
    proteinG: 392,
    calciumMg: 7000,
  };

  it("sodium landmine: high-sodium product scores lower cosine than lentils", () => {
    const limits = { sodium: 600, sugar: 15, saturatedFat: 5, glycemicIndex: 55 };
    const axisWeights = new Map([
      ["fiber", 2],
      ["glycemicIndex", 2],
      ["sodium", 2],
    ] as const);

    const ideal = buildIdealVector(weeklyRda, axisWeights as never, limits);

    const lentils = buildProductVector(
      {
        fiberG: 8,
        proteinG: 9,
        ironMg: 3,
        vitaminCMg: 1,
        calciumMg: 20,
        sodiumMg: 5,
        sugarG: 1,
        saturatedFatG: 0.1,
        glycemicIndex: 30,
      } as never,
      100,
      weeklyRda,
      limits,
    );

    const junk = buildProductVector(
      {
        fiberG: 1,
        proteinG: 2,
        ironMg: 0.5,
        vitaminCMg: 0,
        calciumMg: 10,
        sodiumMg: 800,
        sugarG: 20,
        saturatedFatG: 8,
        glycemicIndex: 75,
      } as never,
      100,
      weeklyRda,
      limits,
    );

    expect(cosineSimilarity(lentils, ideal)).toBeGreaterThan(
      cosineSimilarity(junk, ideal),
    );
  });

  it("zero vector magnitude returns 0 cosine contribution", () => {
    const v = emptyVector();
    expect(vectorMagnitude(v)).toBe(0);
  });

  it("all-null nutrition yields zero boost axes", () => {
    const vec = buildProductVector(null, 100, weeklyRda, {});
    expect(vec.fiber).toBe(0);
    expect(vec.protein).toBe(0);
  });
});
