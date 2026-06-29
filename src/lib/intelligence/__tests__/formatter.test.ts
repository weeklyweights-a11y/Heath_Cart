import { describe, expect, it } from "vitest";
import { buildConstrainedFormatterPrompt } from "@/lib/prompts/formatter";

describe("formatter-agent", () => {
  it("constrained prompt lists allowed products only", () => {
    const prompt = buildConstrainedFormatterPrompt({
      message: "Jake has a cold",
      allowedProductNames: ["Kale", "Orange"],
      basketLines: ["- Kale ×2"],
      traceSummary: "Safety audit passed.",
    });
    expect(prompt).toContain("Kale");
    expect(prompt).toContain("Orange");
    expect(prompt).toContain("Do NOT invent");
  });
});
