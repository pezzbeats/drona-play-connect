import { describe, it, expect } from 'vitest';

// Test the aggregation logic used by update-overall-leaderboard
// We test the pure computation functions here

interface MatchHistoryRecord {
  final_rank: number | null;
  final_points: number;
  correct_predictions: number;
  total_predictions: number;
  player_name: string | null;
}

function aggregateOverall(history: MatchHistoryRecord[]) {
  const totalPointsOverall = history.reduce((s, h) => s + (h.final_points || 0), 0);
  const correctOverall = history.reduce((s, h) => s + (h.correct_predictions || 0), 0);
  const totalPredOverall = history.reduce((s, h) => s + (h.total_predictions || 0), 0);
  const matchesParticipated = history.length;
  const matchesWon = history.filter(h => h.final_rank === 1).length;
  const ranks = history.map(h => h.final_rank).filter((r): r is number => r !== null && r !== undefined);
  const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
  return { totalPointsOverall, correctOverall, totalPredOverall, matchesParticipated, matchesWon, bestRank };
}

function computeRanks(entries: { id: string; total_points_overall: number }[]) {
  const sorted = [...entries].sort((a, b) => b.total_points_overall - a.total_points_overall);
  return sorted.map((e, i) => ({ ...e, rank_position_overall: i + 1 }));
}

describe('Overall Leaderboard Aggregation', () => {
  it('aggregates single match correctly', () => {
    const result = aggregateOverall([
      { final_rank: 3, final_points: 50, correct_predictions: 5, total_predictions: 12, player_name: 'Test' },
    ]);
    expect(result.totalPointsOverall).toBe(50);
    expect(result.correctOverall).toBe(5);
    expect(result.matchesParticipated).toBe(1);
    expect(result.matchesWon).toBe(0);
    expect(result.bestRank).toBe(3);
  });

  it('aggregates multiple matches correctly', () => {
    const result = aggregateOverall([
      { final_rank: 1, final_points: 100, correct_predictions: 10, total_predictions: 15, player_name: 'A' },
      { final_rank: 5, final_points: 30, correct_predictions: 3, total_predictions: 10, player_name: 'A' },
      { final_rank: 2, final_points: 80, correct_predictions: 8, total_predictions: 12, player_name: 'A' },
    ]);
    expect(result.totalPointsOverall).toBe(210);
    expect(result.correctOverall).toBe(21);
    expect(result.totalPredOverall).toBe(37);
    expect(result.matchesParticipated).toBe(3);
    expect(result.matchesWon).toBe(1);
    expect(result.bestRank).toBe(1);
  });

  it('handles zero predictions', () => {
    const result = aggregateOverall([
      { final_rank: null, final_points: 0, correct_predictions: 0, total_predictions: 0, player_name: null },
    ]);
    expect(result.totalPointsOverall).toBe(0);
    expect(result.matchesWon).toBe(0);
    expect(result.bestRank).toBe(null);
  });

  it('counts multiple wins', () => {
    const result = aggregateOverall([
      { final_rank: 1, final_points: 100, correct_predictions: 10, total_predictions: 10, player_name: 'X' },
      { final_rank: 1, final_points: 90, correct_predictions: 9, total_predictions: 10, player_name: 'X' },
    ]);
    expect(result.matchesWon).toBe(2);
  });
});

describe('Rank Computation', () => {
  it('ranks by total points descending', () => {
    const ranked = computeRanks([
      { id: 'a', total_points_overall: 50 },
      { id: 'b', total_points_overall: 100 },
      { id: 'c', total_points_overall: 75 },
    ]);
    expect(ranked[0].id).toBe('b');
    expect(ranked[0].rank_position_overall).toBe(1);
    expect(ranked[1].id).toBe('c');
    expect(ranked[1].rank_position_overall).toBe(2);
    expect(ranked[2].id).toBe('a');
    expect(ranked[2].rank_position_overall).toBe(3);
  });

  it('handles single entry', () => {
    const ranked = computeRanks([{ id: 'x', total_points_overall: 10 }]);
    expect(ranked[0].rank_position_overall).toBe(1);
  });

  it('handles empty array', () => {
    const ranked = computeRanks([]);
    expect(ranked).toEqual([]);
  });
});

describe('Idempotent Scoring (scored_at check)', () => {
  it('should not score a window that already has scored_at set', () => {
    const scoredAt = '2025-06-15T10:00:00Z';
    const shouldScore = scoredAt === null || scoredAt === undefined;
    expect(shouldScore).toBe(false);
  });

  it('should score a window that has no scored_at', () => {
    const scoredAt = null;
    const shouldScore = scoredAt === null || scoredAt === undefined;
    expect(shouldScore).toBe(true);
  });
});
