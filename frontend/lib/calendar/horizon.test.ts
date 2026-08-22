import { describe, expect, it } from "vitest";
import { PLANNING_HORIZON_DAYS } from "./constants";
import { dayOffsetInHorizon, getPlanningHorizon, parseRequestNowHour, parseRequestToday } from "./horizon";
import { toISODate } from "./dateUtils";

describe("getPlanningHorizon", () => {
  it("returns PLANNING_HORIZON_DAYS consecutive days starting today", () => {
    const today = new Date(2026, 7, 12);
    const horizon = getPlanningHorizon(today);

    expect(horizon.days).toHaveLength(PLANNING_HORIZON_DAYS);
    expect(horizon.startISO).toBe("2026-08-12");
    expect(horizon.endISO).toBe(toISODate(horizon.days[PLANNING_HORIZON_DAYS - 1]));
  });

  it("spans exactly 13 days from start to end (14 inclusive days)", () => {
    const horizon = getPlanningHorizon(new Date(2026, 7, 12));
    expect(horizon.startISO).toBe("2026-08-12");
    expect(horizon.endISO).toBe("2026-08-25");
  });
});

describe("dayOffsetInHorizon", () => {
  const horizon = getPlanningHorizon(new Date(2026, 7, 12));

  it("is 0 for the horizon's own first day", () => {
    expect(dayOffsetInHorizon(horizon, "2026-08-12")).toBe(0);
  });

  it("is positive for a date later within the horizon", () => {
    expect(dayOffsetInHorizon(horizon, "2026-08-15")).toBe(3);
  });

  it("is negative for a date before the horizon (overdue)", () => {
    expect(dayOffsetInHorizon(horizon, "2026-08-10")).toBe(-2);
  });
});

describe("parseRequestToday", () => {
  it("parses a well-formed body", () => {
    const result = parseRequestToday({ today: "2026-08-12" });
    expect(result).not.toBeNull();
    expect(toISODate(result!)).toBe("2026-08-12");
  });

  it("rejects a missing today field", () => {
    expect(parseRequestToday({})).toBeNull();
  });

  it("rejects a non-string today field", () => {
    expect(parseRequestToday({ today: 12345 })).toBeNull();
  });

  it("rejects a malformed date format", () => {
    expect(parseRequestToday({ today: "08/12/2026" })).toBeNull();
    expect(parseRequestToday({ today: "2026-8-1" })).toBeNull();
  });

  it("rejects a non-object body", () => {
    expect(parseRequestToday(null)).toBeNull();
    expect(parseRequestToday("2026-08-12")).toBeNull();
  });
});

describe("parseRequestNowHour", () => {
  it("parses a well-formed decimal hour", () => {
    expect(parseRequestNowHour({ nowHour: 15.5 })).toBe(15.5);
  });

  it("accepts the lower boundary (midnight)", () => {
    expect(parseRequestNowHour({ nowHour: 0 })).toBe(0);
  });

  it("rejects 24 and above", () => {
    expect(parseRequestNowHour({ nowHour: 24 })).toBeNull();
    expect(parseRequestNowHour({ nowHour: 25 })).toBeNull();
  });

  it("rejects a negative hour", () => {
    expect(parseRequestNowHour({ nowHour: -1 })).toBeNull();
  });

  it("rejects a missing nowHour field", () => {
    expect(parseRequestNowHour({})).toBeNull();
  });

  it("rejects a non-number nowHour field", () => {
    expect(parseRequestNowHour({ nowHour: "15.5" })).toBeNull();
  });

  it("rejects non-finite values", () => {
    expect(parseRequestNowHour({ nowHour: NaN })).toBeNull();
    expect(parseRequestNowHour({ nowHour: Infinity })).toBeNull();
  });

  it("rejects a non-object body", () => {
    expect(parseRequestNowHour(null)).toBeNull();
    expect(parseRequestNowHour(15.5)).toBeNull();
  });
});
