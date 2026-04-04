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

function sortCollectionEntries(node: unknown): Array<[string, any]> {
  if (Array.isArray(node)) return node.map((value, index) => [String(index), value]);
  if (!node || typeof node !== 'object') return [];

  return Object.entries(node as Record<string, any>).sort(([a], [b]) => {
    const numA = Number(a);
    const numB = Number(b);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

function extractOversFromInningsForTest(inningsNode: any): Array<{ overNo: number; balls: any[] }> {
  const oversNode = inningsNode?.overs ?? inningsNode;

  return sortCollectionEntries(oversNode).map(([key, over], index) => ({
    overNo: over?.over_number ?? over?.number ?? Number(key) ?? index + 1,
    balls: sortCollectionEntries(over?.balls ?? over?.deliveries).map(([, ball]) => ball),
  }));
}

function resolveBallIdentityForTest(ball: any, fallbackIndex: number, keyHint?: string): number {
  const candidates = [
    ball?.ball_number,
    ball?.ball,
    ball?.number,
    ball?.delivery_number,
    ball?.sequence,
    ball?.index,
    ball?.delivery?.number,
    keyHint,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return fallbackIndex + 1;
}

function detectDegradedSync(progressAdvanced: boolean, normalizedDeliveries: number) {
  return progressAdvanced && normalizedDeliveries === 0;
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

describe('ball-by-ball parser hardening', () => {
  it('parses overs when they are stored as object maps', () => {
    const overs = extractOversFromInningsForTest({
      overs: {
        '12': { over_number: 13, balls: { '0': { number: 1 }, '1': { number: 2 } } },
      },
    });

    expect(overs).toHaveLength(1);
    expect(overs[0].overNo).toBe(13);
    expect(overs[0].balls).toHaveLength(2);
  });

  it('parses balls when they are stored as object maps', () => {
    const overs = extractOversFromInningsForTest({
      overs: {
        '0': {
          over_number: 1,
          balls: {
            a: { delivery_number: 1 },
            b: { delivery_number: 2 },
            c: { delivery_number: 3 },
          },
        },
      },
    });

    expect(overs[0].balls).toHaveLength(3);
  });

  it('resolves ball number from alternate field names', () => {
    expect(resolveBallIdentityForTest({ number: 4 }, 0)).toBe(4);
    expect(resolveBallIdentityForTest({ delivery_number: 5 }, 0)).toBe(5);
    expect(resolveBallIdentityForTest({ sequence: 6 }, 0)).toBe(6);
    expect(resolveBallIdentityForTest({ delivery: { number: 2 } }, 0)).toBe(2);
  });

  it('falls back to loop index instead of collapsing every ball to 1', () => {
    const identities = [
      resolveBallIdentityForTest({}, 0),
      resolveBallIdentityForTest({}, 1),
      resolveBallIdentityForTest({}, 2),
    ];

    expect(identities).toEqual([1, 2, 3]);
  });

  it('flags degraded sync when score advances without normalized deliveries', () => {
    expect(detectDegradedSync(true, 0)).toBe(true);
    expect(detectDegradedSync(true, 2)).toBe(false);
    expect(detectDegradedSync(false, 0)).toBe(false);
  });
});

// ── Innings resolver logic (mirrors cricket-api-sync safe resolver) ──
function resolveCurrentInnings(
  inn1Score: number, inn1Overs: number,
  inn2Score: number, inn2Overs: number, inn2Wickets: number,
  apiStatusStr: string
): number {
  const inn2HasRealActivity = (inn2Overs > 0 && inn2Score > 0) || inn2Wickets > 0;
  const inn1HasMinimalScore = inn1Score > 0 || inn1Overs >= 1;
  const apiStatusHint = (apiStatusStr || "").toLowerCase();
  const apiSaysInnings2 = apiStatusHint.includes("2nd") || apiStatusHint.includes("innings 2") || apiStatusHint.includes("second");

  if (apiSaysInnings2 && inn1HasMinimalScore) return 2;
  if (inn2HasRealActivity && inn1HasMinimalScore) return 2;
  return 1;
}

describe('resolveCurrentInnings', () => {
  it('returns 1 when only innings 1 has data', () => {
    expect(resolveCurrentInnings(85, 10, 0, 0, 0, "Live - In Progress")).toBe(1);
  });

  it('returns 1 when innings 2 has structural shell but no real activity', () => {
    // This is the key bug fix: inn2 exists in payload but has 0/0/0
    expect(resolveCurrentInnings(180, 20, 0, 0, 0, "Live")).toBe(1);
  });

  it('returns 2 when innings 2 has real ball activity', () => {
    expect(resolveCurrentInnings(180, 20, 45, 5, 1, "Live")).toBe(2);
  });

  it('returns 2 when API status says 2nd innings', () => {
    expect(resolveCurrentInnings(180, 20, 0, 0, 0, "2nd Innings - In Progress")).toBe(2);
  });

  it('returns 1 when API says 2nd but innings 1 has no score', () => {
    // Edge case: API is ahead of our data
    expect(resolveCurrentInnings(0, 0, 0, 0, 0, "2nd Innings")).toBe(1);
  });

  it('returns 2 when inn2 has wickets but no score', () => {
    expect(resolveCurrentInnings(150, 20, 0, 0, 1, "Live")).toBe(2);
  });
});
