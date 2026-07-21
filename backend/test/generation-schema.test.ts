import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import {
  evidenceLabelForLevel,
  evidenceLevelSchema,
} from "../src/domain.js";
import {
  applyPortfolioEvidenceDepthFloor,
  derivePortfolioInterestCategories,
  refinePortfolioInterests,
  normalizeGeneratedInsight,
  projectInsightResponseSchema,
} from "../src/generation.js";

describe("OpenAI project insight response schema", () => {
  it("requests each radar dimension exactly once by name", () => {
    const format = zodTextFormat(projectInsightResponseSchema, "project_insight") as unknown as {
      schema: {
        properties: {
          radar: {
            properties: {
              imagination: {
                properties: Record<string, unknown>;
              };
            };
            required: string[];
          };
        };
      };
    };

    const radar = format.schema.properties.radar;

    expect(radar.required).toEqual([
      "imagination",
      "expression",
      "game_design",
      "experimentation",
      "iteration",
      "reflection",
    ]);
    expect(radar.properties.imagination.properties).toHaveProperty("level");
    expect(radar.properties.imagination.properties).not.toHaveProperty("key");
    expect(radar.properties.imagination.properties).not.toHaveProperty("label");
  });

  it("accepts integer evidence depth from zero through ten", () => {
    expect(evidenceLevelSchema.safeParse(0).success).toBe(true);
    expect(evidenceLevelSchema.safeParse(10).success).toBe(true);
    expect(evidenceLevelSchema.safeParse(11).success).toBe(false);
    expect(evidenceLevelSchema.safeParse(4.5).success).toBe(false);
  });

  it("maps evidence depth into parent-friendly descriptive bands", () => {
    expect(evidenceLabelForLevel(0)).toBe("Not enough evidence");
    expect(evidenceLabelForLevel(2)).toBe("Emerging");
    expect(evidenceLabelForLevel(5)).toBe("Demonstrated");
    expect(evidenceLabelForLevel(8)).toBe("Repeated");
    expect(evidenceLabelForLevel(10)).toBe("Sustained");
  });

  it("derives canonical radar keys, order, and labels on the backend", () => {
    const dimension = (level: number) => ({
      level,
      observation: "Supported by the available project history.",
      evidence: ["A named project provides this evidence."],
    });
    const insight = normalizeGeneratedInsight({
      summary: "A portfolio summary.",
      dimensions: [
        {
          name: "Creative exploration",
          observation: "The child explored an idea.",
          evidence: ["Space Penguin introduced an original setting."],
        },
        {
          name: "Iteration",
          observation: "The project history records a change.",
          evidence: ["Version 2 changed the goal."],
        },
      ],
      interests: ["Space"],
      conversationStarters: ["What inspired this world?", "What would you change next?"],
      disclaimer: "This is a portfolio observation, not an assessment.",
      radar: {
        imagination: dimension(10),
        expression: dimension(8),
        game_design: dimension(5),
        experimentation: dimension(3),
        iteration: dimension(1),
        reflection: dimension(0),
      },
    });

    expect(insight.radar.dimensions.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "imagination", label: "Sustained" },
      { key: "expression", label: "Repeated" },
      { key: "game_design", label: "Demonstrated" },
      { key: "experimentation", label: "Emerging" },
      { key: "iteration", label: "Not enough evidence" },
      { key: "reflection", label: "Not enough evidence" },
    ]);
  });

  it("keeps repeated portfolio evidence in the repeated band", () => {
    const dimension = (level: number) => ({
      level,
      observation: "The supplied project history supports this observation.",
      evidence: ["A named project version provides this evidence."],
    });
    const baseInsight = normalizeGeneratedInsight({
      summary: "A portfolio summary.",
      dimensions: [
        {
          name: "Creative practice",
          observation: "The child developed ideas through multiple versions.",
          evidence: ["Moonlight Adventure includes several saved revisions."],
        },
        {
          name: "Reflection",
          observation: "Later prompts explain playtest observations.",
          evidence: ["A later request explains why timing changed."],
        },
      ],
      interests: ["Moonlight adventures"],
      conversationStarters: ["What did you notice while playing?", "Why did you change the ending?"],
      disclaimer: "This is a portfolio observation, not an assessment.",
      radar: {
        imagination: dimension(5),
        expression: dimension(5),
        game_design: dimension(5),
        experimentation: dimension(5),
        iteration: dimension(5),
        reflection: dimension(5),
      },
    });
    const detailedMechanicPrompts = [
      "I want the player to tap five blue whispers, avoid a thorn cloud, keep three hearts, and build a score combo.",
      "I tested the first round and noticed it was too fast, so make the timer slower and add a clear hint.",
      "After playing, I noticed three memory notes worked better because a longer sequence felt frustrating.",
      "I tried the ending twice and noticed the choice should let the player try again instead of losing.",
      "I think the final replay button should keep the score visible and celebrate the player's kind choice.",
      "I tested the whole game and changed the rule so slow reading never removes a heart.",
    ];
    const project = (id: string, prompt: string, extraPrompts: string[] = []) => ({
      id,
      title: `Project ${id}`,
      versions: [prompt, ...extraPrompts].map((versionPrompt, index) => ({
        id: `${id}-${index + 1}`,
        projectId: id,
        versionNumber: index + 1,
        prompt: versionPrompt,
        html: "<!doctype html><title>Game</title>",
        createdAt: "2026-07-21T00:00:00.000Z",
      })),
    });
    const insight = applyPortfolioEvidenceDepthFloor(baseInsight, [
      project("one", "A moonlight fox adventure.", detailedMechanicPrompts),
      project("two", "A rainbow travel puzzle where the player chooses a path."),
      project("three", "A family golf game with a goal and a surprise ball."),
      project("four", "A bird game about making a friend happy."),
    ]);

    expect(insight.radar.dimensions.map(({ level, label }) => ({ level, label }))).toEqual([
      { level: 7, label: "Repeated" },
      { level: 7, label: "Repeated" },
      { level: 7, label: "Repeated" },
      { level: 7, label: "Repeated" },
      { level: 8, label: "Repeated" },
      { level: 7, label: "Repeated" },
    ]);
  });

  it("turns project evidence into broad child-interest categories", () => {
    const projects = [
      {
        id: "wish",
        title: "The Lost Little Wish",
        versions: [{
          id: "wish-1",
          projectId: "wish",
          versionNumber: 1,
          prompt: "A fox listens to magical whispers in a forest and chooses a kind ending.",
          html: "<!doctype html><title>Game</title>",
          createdAt: "2026-07-21T00:00:00.000Z",
        }],
      },
      {
        id: "golf",
        title: "The Family Golf Adventure",
        versions: [{
          id: "golf-1",
          projectId: "golf",
          versionNumber: 1,
          prompt: "A colorful golf ball travels through a playful family sports challenge.",
          html: "<!doctype html><title>Game</title>",
          createdAt: "2026-07-21T00:00:00.000Z",
        }],
      },
    ];

    const categories = derivePortfolioInterestCategories(projects);
    expect(categories).toContain("Magical worlds & adventures");
    expect(categories).toContain("Animal heroes & companions");
    expect(categories).toContain("Playful sports & movement");
    expect(categories).not.toContain("The Lost Little Wish");
  });

  it("removes exact project titles from generated portfolio interests", () => {
    const project = {
      id: "wish",
      title: "The Lost Little Wish",
      versions: [{
        id: "wish-1",
        projectId: "wish",
        versionNumber: 1,
        prompt: "A fox explores a magical forest story.",
        html: "<!doctype html><title>Game</title>",
        createdAt: "2026-07-21T00:00:00.000Z",
      }],
    };
    const dimension = (level: number) => ({
      level,
      observation: "Supported by the available project history.",
      evidence: ["A named project version provides this evidence."],
    });
    const insight = normalizeGeneratedInsight({
      summary: "A portfolio summary.",
      dimensions: [
        { name: "Ideas", observation: "The child explored a world.", evidence: ["The story uses a fox."] },
        { name: "Choices", observation: "The child made choices.", evidence: ["The child chose a setting."] },
      ],
      interests: ["The Lost Little Wish", "Storytelling & fantasy"],
      conversationStarters: ["What inspired this world?", "What would you add next?"],
      disclaimer: "This is a portfolio observation, not an assessment.",
      radar: {
        imagination: dimension(5),
        expression: dimension(5),
        game_design: dimension(5),
        experimentation: dimension(5),
        iteration: dimension(5),
        reflection: dimension(5),
      },
    });

    const refined = refinePortfolioInterests(insight, [project]);
    expect(refined.interests).not.toContain("The Lost Little Wish");
    expect(refined.interests).toContain("Storytelling & fantasy");
    expect(refined.interests).toContain("Animal heroes & companions");
  });
});
