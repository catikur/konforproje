import { describe, expect, it } from "vitest";
import { extractFromImage, ocrModel, ocrBaseUrl } from "../src/ocr/extract";

describe("OCR extract", () => {
  it("varsayılan OpenRouter Grok 4.6", () => {
    delete process.env.OCR_MODEL;
    delete process.env.OPENAI_OCR_MODEL;
    delete process.env.OCR_BASE_URL;
    expect(ocrModel()).toBe("x-ai/grok-4.6");
    expect(ocrBaseUrl()).toBe("https://openrouter.ai/api/v1");
  });

  it("anahtar yoksa atlar", async () => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OCR_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const r = await extractFromImage(Buffer.from("x"), "image/jpeg");
    expect(r.skipped).toBe(true);
  });

  it("PDF için görsel ister", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    const r = await extractFromImage(Buffer.from("x"), "application/pdf");
    expect(r.reason).toMatch(/görsel/i);
    delete process.env.OPENROUTER_API_KEY;
  });
});
