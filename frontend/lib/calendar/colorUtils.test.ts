import { describe, expect, it } from "vitest";
import { isValidHex, shadeColor } from "./colorUtils";

describe("shadeColor", () => {
  it("darkens by a negative percent", () => {
    expect(shadeColor("#808080", -50)).toBe("#404040");
  });

  it("lightens by a positive percent", () => {
    expect(shadeColor("#808080", 50)).toBe("#c0c0c0");
  });

  it("clamps at 255 rather than overflowing", () => {
    expect(shadeColor("#ffffff", 50)).toBe("#ffffff");
  });

  it("clamps at 0 rather than going negative - darkening or lightening pure black stays black", () => {
    expect(shadeColor("#000000", 50)).toBe("#000000");
    expect(shadeColor("#000000", -50)).toBe("#000000");
  });

  it("rounds fractional channel values", () => {
    expect(shadeColor("#ffffff", -50)).toBe("#808080");
  });
});

describe("isValidHex", () => {
  it("accepts a well-formed 6-digit hex color", () => {
    expect(isValidHex("#a1b2c3")).toBe(true);
    expect(isValidHex("#FFFFFF")).toBe(true);
  });

  it("rejects missing #, wrong length, and non-hex characters", () => {
    expect(isValidHex("a1b2c3")).toBe(false);
    expect(isValidHex("#fff")).toBe(false);
    expect(isValidHex("#a1b2c3d4")).toBe(false);
    expect(isValidHex("#gggggg")).toBe(false);
  });
});
