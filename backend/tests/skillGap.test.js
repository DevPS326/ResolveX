'use strict';

const {
  buildSkillProfile,
  evaluateTagGap,
  suggestDifficultyRange
} = require('../services/skillGapService');

function makeSolved(contestId, problemIndex, tags = [], rating = 1200, creationTimeSeconds = 0) {
  return {
    contestId,
    problemIndex,
    verdict: 'OK',
    tags,
    problemRating: rating,
    creationTimeSeconds
  };
}

describe('buildSkillProfile', () => {
  test('deduplicates accepted submissions by problem', () => {
    const subs = [
      makeSolved(1, 'A', ['greedy'], 1200),
      makeSolved(1, 'A', ['greedy'], 1200),
      makeSolved(1, 'B', ['dp'], 1400)
    ];

    const profile = buildSkillProfile(subs, 10_000_000);
    expect(profile.totalSolved).toBe(2);
    expect(profile.tags.greedy.solvedCount).toBe(1);
    expect(profile.tags.dp.solvedCount).toBe(1);
  });

  test('captures difficulty instead of only relative tag frequency', () => {
    const subs = [
      makeSolved(1, 'A', ['greedy'], 1200),
      makeSolved(1, 'B', ['greedy'], 1600),
      makeSolved(1, 'C', ['greedy'], 2000),
      makeSolved(1, 'D', ['greedy'], 2400)
    ];

    const profile = buildSkillProfile(subs, 10_000_000);
    expect(profile.tags.greedy.ratedCount).toBe(4);
    expect(profile.tags.greedy.q75Rating).toBe(2000);
    expect(profile.tags.greedy.maxRating).toBe(2400);
  });
});

describe('evaluateTagGap', () => {
  test('does not call high-volume lower-difficulty peer activity a gap', () => {
    const result = evaluateTagGap(
      { solvedCount: 30, ratedCount: 30, recentCount: 2, q75Rating: 3000 },
      { solvedCount: 80, ratedCount: 80, recentCount: 8, q75Rating: 1800 },
      { myRating: 3900, peerRating: 2400, myDifficultyFloor: 3300 }
    );

    expect(result.gapLevel).toBe('NONE');
  });

  test('uses elite rating/history as a floor even when old tag q75 is lower', () => {
    const result = evaluateTagGap(
      { solvedCount: 100, ratedCount: 100, recentCount: 1, q75Rating: 2100 },
      { solvedCount: 120, ratedCount: 120, recentCount: 8, q75Rating: 2500 },
      { myRating: 3900, peerRating: 2400, myDifficultyFloor: 3300 }
    );

    expect(result.gapLevel).toBe('NONE');
    expect(result.difficultyDelta).toBe(-800);
  });

  test('detects a genuine difficulty-backed gap', () => {
    const result = evaluateTagGap(
      { solvedCount: 2, ratedCount: 2, recentCount: 1, q75Rating: 1300 },
      { solvedCount: 12, ratedCount: 12, recentCount: 4, q75Rating: 1800 },
      { myRating: 1500, peerRating: 1800, myDifficultyFloor: 1400 }
    );

    expect(['HIGH', 'MEDIUM']).toContain(result.gapLevel);
    expect(result.difficultyDelta).toBe(400);
  });

  test('raw volume alone cannot create a medium/high gap at equal difficulty', () => {
    const result = evaluateTagGap(
      { solvedCount: 3, ratedCount: 3, recentCount: 0, q75Rating: 1600 },
      { solvedCount: 30, ratedCount: 30, recentCount: 5, q75Rating: 1600 },
      { myRating: 1600, peerRating: 1700, myDifficultyFloor: 1500 }
    );

    expect(['NONE', 'LOW']).toContain(result.gapLevel);
  });

  test('requires enough rated peer evidence', () => {
    const result = evaluateTagGap(
      null,
      { solvedCount: 2, ratedCount: 2, recentCount: 2, q75Rating: 2200 },
      { myRating: 1400, peerRating: 1800, myDifficultyFloor: 1300 }
    );

    expect(result.gapLevel).toBe('NONE');
  });
});

describe('suggestDifficultyRange', () => {
  test('never recommends beginner difficulty to an elite-rated user', () => {
    const range = suggestDifficultyRange(3900, {
      recentQ75Rating: 3200,
      overallQ75Rating: 2800
    });
    expect(range).toBe('3400-3500');
  });

  test('moves toward peer evidence without jumping arbitrarily far', () => {
    const range = suggestDifficultyRange(1500, {
      recentQ75Rating: 1400,
      overallQ75Rating: 1300
    }, 1800);
    expect(range).toBe('1700-1900');
  });
});
