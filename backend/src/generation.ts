import { createHash } from "node:crypto";
import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { AppConfig } from "./config.js";
import { createDemoGame } from "./demo-game.js";
import {
  type ProjectInsightContent,
  type ProjectVersion,
  projectInsightSchema,
} from "./domain.js";
import { validateAndHardenGameHtml } from "./safety.js";

const generatedGameSchema = z.object({
  title: z.string().min(1).max(80),
  childFacingSummary: z.string().min(1).max(400),
  html: z.string().min(200).max(350_000),
});

const gameSystemPrompt = `You build small, joyful browser games for elementary-aged children.
Return one self-contained HTML document with inline CSS and inline JavaScript.
The game must be touch-friendly, responsive, immediately understandable, and playable without a keyboard.
Use original geometric visuals, emoji, CSS shapes, or inline data assets only.
Do not use external URLs, network requests, forms, iframes, storage APIs, cookies, navigation, popups, eval, dynamic imports, or communication with a parent page.
Do not include ads, purchases, chat, personal-data collection, violent detail, sexual content, hateful content, gambling, or manipulative engagement loops.
Keep the code under 300 KB. Include a title screen, clear controls, feedback, and a replay path.
Return only the fields required by the response schema.`;

const insightSystemPrompt = `You write evidence-based project observations for a parent of an elementary-aged child.
Analyze only the supplied project prompts and version history. Use tentative language such as "in this project" and "may suggest".
Never score, rank, diagnose, compare with other children, predict a career, or claim a fixed trait or ability.
Each observation must cite concrete evidence from the project history.
Focus on creative exploration, iteration, problem solving, systems thinking, follow-through, communication, and recurring interests when supported.
Conversation starters should help the parent invite the child to explain their choices without testing or judging them.
The disclaimer must say this is a project-based observation, not a psychological or educational assessment.`;

export interface GeneratedGame {
  title: string;
  childFacingSummary: string;
  html: string;
  provider: "openai" | "demo";
}

export class GenerationService {
  private readonly client: OpenAI | null;

  public constructor(private readonly config: AppConfig) {
    this.client = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;
  }

  public async createGame(prompt: string, userId: string): Promise<GeneratedGame> {
    if (!this.client) {
      const demo = createDemoGame(prompt);
      return {
        ...demo,
        childFacingSummary: "Your playable demo is ready. Add an OpenAI API key for full prompt-to-game generation.",
        html: validateAndHardenGameHtml(demo.html),
        provider: "demo",
      };
    }

    const parsed = await this.requestStructured(
      generatedGameSchema,
      "generated_game",
      gameSystemPrompt,
      `Create this game idea:\n${prompt}`,
      userId,
    );
    return {
      ...parsed,
      html: validateAndHardenGameHtml(parsed.html),
      provider: "openai",
    };
  }

  public async editGame(input: {
    instruction: string;
    currentHtml: string;
    versionNumber: number;
    userId: string;
  }): Promise<GeneratedGame> {
    if (!this.client) {
      const demo = createDemoGame(input.instruction, input.versionNumber);
      return {
        ...demo,
        childFacingSummary: "A new local demo version was created from your change request.",
        html: validateAndHardenGameHtml(demo.html),
        provider: "demo",
      };
    }

    const parsed = await this.requestStructured(
      generatedGameSchema,
      "edited_game",
      gameSystemPrompt,
      `Update the current game according to the child's request. Preserve working features unless the request changes them.\n\nCHILD REQUEST:\n${input.instruction}\n\nCURRENT HTML:\n${input.currentHtml}`,
      input.userId,
    );
    return {
      ...parsed,
      html: validateAndHardenGameHtml(parsed.html),
      provider: "openai",
    };
  }

  public async createInsight(input: {
    childUserId: string;
    title: string;
    versions: ProjectVersion[];
  }): Promise<ProjectInsightContent> {
    if (!this.client) return this.demoInsight(input.title, input.versions);

    const history = input.versions
      .map((version) => `Version ${version.versionNumber}: ${version.prompt}`)
      .join("\n");
    return this.requestStructured(
      projectInsightSchema,
      "project_insight",
      insightSystemPrompt,
      `Project title: ${input.title}\nProject history:\n${history}`,
      input.childUserId,
    );
  }

  public async transcribeAudio(input: {
    audio: Buffer;
    fileName: string;
    mediaType: string;
  }): Promise<string> {
    if (!this.client) {
      const error = new Error("Voice transcription requires OPENAI_API_KEY on the backend");
      Object.assign(error, { statusCode: 503 });
      throw error;
    }

    const file = await toFile(input.audio, input.fileName, { type: input.mediaType });
    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: this.config.openAiTranscriptionModel,
    });
    const text = transcription.text.trim();
    if (!text) {
      const error = new Error("No speech was detected. Hold the button and try again.");
      Object.assign(error, { statusCode: 422 });
      throw error;
    }
    return text;
  }

  private async requestStructured<T extends z.ZodType>(
    schema: T,
    schemaName: string,
    systemPrompt: string,
    userPrompt: string,
    userId: string,
  ): Promise<z.infer<T>> {
    if (!this.client) throw new Error("OpenAI client is not configured");
    const response = await this.client.responses.parse({
      model: this.config.openAiModel,
      reasoning: { effort: "low" },
      safety_identifier: createHash("sha256").update(userId).digest("hex"),
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      text: { format: zodTextFormat(schema, schemaName) },
    });

    if (!response.output_parsed) throw new Error("The model did not return a usable result");
    return schema.parse(response.output_parsed);
  }

  private demoInsight(title: string, versions: ProjectVersion[]): ProjectInsightContent {
    const prompts = versions.map((version) => version.prompt);
    const latest = prompts.at(-1) ?? title;
    return {
      summary: `${title} has ${versions.length} saved version${versions.length === 1 ? "" : "s"}. The project shows a child moving from an idea toward a playable result.`,
      dimensions: [
        {
          name: "Creative exploration",
          observation: "The child translated an idea into characters, rules, and an interactive experience.",
          evidence: [`The project began with: “${prompts[0] ?? title}”`],
        },
        {
          name: "Iteration and follow-through",
          observation:
            versions.length > 1
              ? "The child returned to the project and asked for changes, showing an iterative approach in this project."
              : "This is an early version. Future edits may provide more evidence about how the child iterates.",
          evidence: [`The project currently contains ${versions.length} saved version(s).`],
        },
      ],
      interests: [latest.slice(0, 80)],
      conversationStarters: [
        "What part of this game are you most proud of, and why?",
        "If you made one more version, what would you change for the player?",
      ],
      disclaimer:
        "This is a project-based observation intended to support conversation. It is not a psychological, educational, or skills assessment.",
    };
  }
}
