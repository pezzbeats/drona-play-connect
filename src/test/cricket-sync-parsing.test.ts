import { describe, it, expect } from 'vitest';

// Re-implement the parsing functions here for unit testing
// (Edge functions run in Deno, but the parsing logic is pure and testable)

function deliveryToOutcomeKey(runsOffBat: number, isWicket: boolean, extrasType: string): string {
  if (isWicket) return "wicket";
  if (extrasType === "wide") return "wide";
  if (extrasType === "no_ball") return "no_ball";
  if (runsOffBat === 0) return "dot_ball";
  if (runsOffBat === 1) return "runs_1";
  if (runsOffBat === 2) return "runs_2";
  if (runsOffBat === 3) return "runs_3";
  if (runsOffBat === 4) return "boundary_4";
  if (runsOffBat === 6) return "six_6";
  return `runs_${runsOffBat}`;
}

function isApiStatusLive(statusStr: string): boolean {
  const s = (statusStr || "").toLowerCase().trim();
  if (s.includes("not_started") || s.includes("completed") || s.includes("result") || s === "not started") return false;
  if (s.includes("abandoned") || s.includes("no result") || s.includes("postponed")) return false;
  return (
    s.includes("live") ||
    s.includes("in progress") ||
    s.includes("in_progress") ||
    s === "started" ||
    s.includes("play") ||
    s.includes("innings") ||
    s.includes("stumps") ||
    s.includes("break") ||
    s.includes("strategic") ||
    s.includes("timeout")
  );
}

function isAbandonedOrNoResult(statusStr: string): boolean {
  const s = (statusStr || "").toLowerCase().trim();
  return s.includes("abandoned") || s.includes("no result") || s.includes("postponed") || s.includes("no_result");
}

describe('deliveryToOutcomeKey', () => {
  it('returns dot_ball for 0 runs, no wicket, no extras', () => {
    expect(deliveryToOutcomeKey(0, false, "none")).toBe("dot_ball");
  });

  it('returns runs_1 through runs_3', () => {
    expect(deliveryToOutcomeKey(1, false, "none")).toBe("runs_1");
    expect(deliveryToOutcomeKey(2, false, "none")).toBe("runs_2");
    expect(deliveryToOutcomeKey(3, false, "none")).toBe("runs_3");
  });

  it('returns boundary_4 for 4 runs', () => {
    expect(deliveryToOutcomeKey(4, false, "none")).toBe("boundary_4");
  });

  it('returns six_6 for 6 runs', () => {
    expect(deliveryToOutcomeKey(6, false, "none")).toBe("six_6");
  });

  it('returns wicket when isWicket is true regardless of runs', () => {
    expect(deliveryToOutcomeKey(0, true, "none")).toBe("wicket");
    expect(deliveryToOutcomeKey(2, true, "none")).toBe("wicket");
  });

  it('returns wide for wide extras', () => {
    expect(deliveryToOutcomeKey(0, false, "wide")).toBe("wide");
  });

  it('returns no_ball for no_ball extras', () => {
    expect(deliveryToOutcomeKey(0, false, "no_ball")).toBe("no_ball");
  });

  it('returns runs_5 for unusual 5 runs', () => {
    expect(deliveryToOutcomeKey(5, false, "none")).toBe("runs_5");
  });

  it('wicket takes priority over wide', () => {
    expect(deliveryToOutcomeKey(0, true, "wide")).toBe("wicket");
  });
});

describe('isApiStatusLive', () => {
  it('returns true for live statuses', () => {
    expect(isApiStatusLive("started")).toBe(true);
    expect(isApiStatusLive("In Play")).toBe(true);
    expect(isApiStatusLive("Live - In Progress")).toBe(true);
    expect(isApiStatusLive("innings break")).toBe(true);
    expect(isApiStatusLive("strategic timeout")).toBe(true);
    expect(isApiStatusLive("stumps")).toBe(true);
  });

  it('returns false for completed/not started', () => {
    expect(isApiStatusLive("completed")).toBe(false);
    expect(isApiStatusLive("not_started")).toBe(false);
    expect(isApiStatusLive("not started")).toBe(false);
    expect(isApiStatusLive("result")).toBe(false);
  });

  it('returns false for abandoned/no result/postponed', () => {
    expect(isApiStatusLive("abandoned")).toBe(false);
    expect(isApiStatusLive("no result")).toBe(false);
    expect(isApiStatusLive("postponed")).toBe(false);
  });

  it('handles empty/undefined strings', () => {
    expect(isApiStatusLive("")).toBe(false);
  });
});

describe('isAbandonedOrNoResult', () => {
  it('detects abandoned', () => {
    expect(isAbandonedOrNoResult("match abandoned")).toBe(true);
    expect(isAbandonedOrNoResult("Abandoned due to rain")).toBe(true);
  });

  it('detects no result', () => {
    expect(isAbandonedOrNoResult("no result")).toBe(true);
    expect(isAbandonedOrNoResult("no_result")).toBe(true);
  });

  it('detects postponed', () => {
    expect(isAbandonedOrNoResult("postponed")).toBe(true);
  });

  it('returns false for normal statuses', () => {
    expect(isAbandonedOrNoResult("started")).toBe(false);
    expect(isAbandonedOrNoResult("completed")).toBe(false);
  });
});
