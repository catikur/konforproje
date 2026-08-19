import { describe, expect, it } from "vitest";
import { extractFromImage } from "../src/ocr/extract";

describe("OCR extract", () => {
  it("anahtar yoksa atlar", async () => {
    delete process.env.OPENAI_API_KEY;
    const r = await extractFromImage(Buffer.from("x"), "image/jpeg");
    expect(r.skipped).toBe(true);
  });

  it("PDF için görsel ister", async () => {
    process.env.OPENAI_API_KEY = "test";
    const r = await extractFromImage(Buffer.from("x"), "application/pdf");
    expect(r.reason).toMatch(/görsel/i);
    delete process.env.OPENAI_API_KEY;
  });
});
