import { describe, expect, it } from "vitest";
import { LoginRateLimiter } from "../src/common/rate-limit";
import { ZodValidationPipe } from "../src/common/zod-pipe";
import { LoginSchema, ListQuerySchema } from "@konfor/shared";
import { HttpException } from "@nestjs/common";

describe("LoginRateLimiter", () => {
  it("8 denemeden sonra 429", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 8; i++) limiter.check("t");
    expect(() => limiter.check("t")).toThrow(HttpException);
  });

  it("reset sonrası tekrar izin verir", () => {
    const limiter = new LoginRateLimiter();
    for (let i = 0; i < 8; i++) limiter.check("t");
    limiter.reset("t");
    expect(() => limiter.check("t")).not.toThrow();
  });
});

describe("ZodValidationPipe", () => {
  it("login body", () => {
    const pipe = new ZodValidationPipe(LoginSchema);
    expect(pipe.transform({ username: "a", password: "b" })).toEqual({
      username: "a",
      password: "b",
    });
  });

  it("hatalı body", () => {
    const pipe = new ZodValidationPipe(LoginSchema);
    expect(() => pipe.transform({ username: "" })).toThrow();
  });

  it("query coerce", () => {
    const pipe = new ZodValidationPipe(ListQuerySchema);
    const q = pipe.transform({ year: "2026", month: "8" }) as { year: number; month: number };
    expect(q.year).toBe(2026);
    expect(q.month).toBe(8);
  });
});
