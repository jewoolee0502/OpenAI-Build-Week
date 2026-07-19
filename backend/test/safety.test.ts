import { describe, expect, it } from "vitest";
import { createDemoGame } from "../src/demo-game.js";
import { UnsafeGameBundleError, validateAndHardenGameHtml } from "../src/safety.js";

describe("game bundle safety", () => {
  it("hardens the built-in demo game", () => {
    const result = validateAndHardenGameHtml(createDemoGame("frog catches stars").html);
    expect(result).toContain("Content-Security-Policy");
    expect(result).toContain("connect-src 'none'");
  });

  it("rejects network access", () => {
    const html = "<html><body><script>fetch('https://example.com')</script></body></html>";
    expect(() => validateAndHardenGameHtml(html)).toThrow(UnsafeGameBundleError);
  });

  it("rejects external scripts", () => {
    const html = '<html><body><script src="https://example.com/game.js"></script></body></html>';
    expect(() => validateAndHardenGameHtml(html)).toThrow(UnsafeGameBundleError);
  });
});
