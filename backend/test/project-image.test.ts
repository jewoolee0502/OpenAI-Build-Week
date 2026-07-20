import { describe, expect, it } from "vitest";
import type { ImageGenerateParamsNonStreaming } from "openai/resources/images";
import { loadConfig } from "../src/config.js";
import { ProjectImageService } from "../src/project-image.js";

const webpBytes = Buffer.from("524946460c0000005745425056503820", "hex");

describe("ProjectImageService", () => {
  it("generates a compact square WebP cover through the OpenAI Image API", async () => {
    let request: ImageGenerateParamsNonStreaming | undefined;
    const service = new ProjectImageService(
      loadConfig({ openAiApiKey: "test-key" }),
      {
        async generate(input) {
          request = input;
          return {
            created: 1,
            data: [{ b64_json: webpBytes.toString("base64") }],
            output_format: "webp",
            quality: "low",
            size: "1024x1024",
          };
        },
      },
    );

    const image = await service.generate({
      childUserId: "11111111-1111-4111-8111-111111111111",
      projectPrompt: "A penguin catches musical stars in space",
    });

    expect(image).toMatchObject({
      provider: "openai",
      model: "gpt-image-2",
      mimeType: "image/webp",
      sourcePrompt: "A penguin catches musical stars in space",
    });
    expect(image.data).toEqual(webpBytes);
    expect(request).toMatchObject({
      model: "gpt-image-2",
      n: 1,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 80,
      background: "opaque",
      moderation: "auto",
    });
    expect(request?.prompt).toContain("A penguin catches musical stars in space");
    expect(request?.user).toMatch(/^[a-f0-9]{64}$/);
    expect(request?.user).not.toBe("11111111-1111-4111-8111-111111111111");
  });

  it("creates a deterministic safe SVG cover when OpenAI is not configured", async () => {
    const config = loadConfig();
    delete config.openAiApiKey;
    const service = new ProjectImageService(config);
    const input = {
      childUserId: "11111111-1111-4111-8111-111111111111",
      projectPrompt: "<script>alert('no')</script> A moon garden",
    };

    const first = await service.generate(input);
    const second = await service.generate(input);

    expect(first.provider).toBe("demo");
    expect(first.model).toBe("local-svg-v1");
    expect(first.mimeType).toBe("image/svg+xml");
    expect(first.data).toEqual(second.data);
    expect(first.data.toString("utf8")).toContain("<svg");
    expect(first.data.toString("utf8")).not.toContain("<script>");
  });

  it("requests four compressed scene interpretations in one server-side image call", async () => {
    let request: ImageGenerateParamsNonStreaming | undefined;
    const service = new ProjectImageService(loadConfig({ openAiApiKey: "test-key" }), {
      async generate(input) {
        request = input;
        return {
          created: 1,
          data: Array.from({ length: 4 }, () => ({ b64_json: webpBytes.toString("base64") })),
          output_format: "webp",
          quality: "low",
          size: "1024x1024",
        };
      },
    });

    const result = await service.generateSceneVariants({
      childUserId: "11111111-1111-4111-8111-111111111111",
      projectPrompt: "A bird flies through a friendly forest",
      canvasSummary: "Background: My forest. Objects: Blue bird near (0.35, 0.40).",
    });

    expect(result?.images).toHaveLength(4);
    expect(request).toMatchObject({
      model: "gpt-image-2",
      n: 4,
      size: "1024x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 55,
      background: "opaque",
      moderation: "auto",
    });
    expect(request?.prompt).toContain("Blue bird");
  });

  it("falls back to a cover image when the provider returns no usable bytes", async () => {
    const service = new ProjectImageService(loadConfig({ openAiApiKey: "test-key" }), {
      async generate() {
        return { created: 1, data: [] };
      },
    });

    const image = await service.generate({
      childUserId: "11111111-1111-4111-8111-111111111111",
      projectPrompt: "A friendly robot builds a rainbow bridge",
    });

    expect(image.provider).toBe("demo");
    expect(image.fallbackReason).toBe("provider_error");
    expect(image.data.length).toBeGreaterThan(0);
  });
});
