import { describe, expect, it } from "vitest";
import { calculateMoney } from "./index";

describe("calculateMoney", () => {
  it("dahil KDV %20", () => {
    const r = calculateMoney(120, "INCLUDED", 20);
    expect(r.grossAmount).toBe(120);
    expect(r.netAmount).toBe(100);
    expect(r.vatAmount).toBe(20);
  });

  it("hariç KDV %20", () => {
    const r = calculateMoney(100, "EXCLUDED", 20);
    expect(r.netAmount).toBe(100);
    expect(r.vatAmount).toBe(20);
    expect(r.grossAmount).toBe(120);
  });
});
