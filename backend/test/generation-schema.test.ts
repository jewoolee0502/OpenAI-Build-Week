import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { projectInsightSchema } from "../src/domain.js";

describe("OpenAI project insight response schema", () => {
  it("uses one object schema for every radar dimension", () => {
    const format = zodTextFormat(projectInsightSchema, "project_insight") as unknown as {
      schema: {
        properties: {
          radar: {
            properties: {
              dimensions: { items: unknown };
            };
          };
        };
      };
    };

    const items = format.schema.properties.radar.properties.dimensions.items;

    expect(Array.isArray(items)).toBe(false);
    expect(items).toMatchObject({ type: "object" });
  });
});
