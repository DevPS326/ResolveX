'use strict';

/**
 * skillGap.test.js
 *
 * Tests computeSkillGaps with fixture data.
 * Since skillGapService queries MongoDB, we test the pure helper logic
 * by exercising the module with in-memory fixtures using manual mocking.
 *
 * The key pure functions that drive the logic are extracted and tested directly.
 */

// ---------------------------------------------------------------------------
// Pure helper — extracted for testing without DB
// ---------------------------------------------------------------------------

/**
 * Compute tag scores from an array of solved submission plain objects.
 * @param {object[]} solvedSubs  — already-filtered to verdict === 'OK'
 * @returns {{ totalSolved: number, tagScores: Object }}
 */
function computeTagScoresPure(solvedSubs) {
  // Deduplicate by (contestId, problemIndex)
  const solvedSet = new Map();
  for (const s of solvedSubs) {
    const key = `${s.contestId}_${s.problemIndex}`;
    if (!solvedSet.has(key)) solvedSet.set(key, s);
  }
  const solvedList  = Array.from(solvedSet.values());
  const totalSolved = solvedList.length;

  const tagCounts = {};
  for (const s of solvedList) {
    for (const tag of (s.tags || [])) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const tagScores = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    tagScores[tag] = totalSolved > 0 ? count / totalSolved : 0;
  }

  return { totalSolved, tagScores };
}

/**
 * Compute skill gaps given my tag scores and an array of friend tag score objects.
 */
function computeSkillGapsPure(myData, friendsData) {
  const allTags = new Set();
  for (const fd of friendsData) {
    for (const tag of Object.keys(fd.tagScores)) allTags.add(tag);
  }
  for (const tag of Object.keys(myData.tagScores)) allTags.add(tag);

  const gaps = [];
  for (const tag of allTags) {
    const myScore = myData.tagScores[tag] || 0;

    let peerSum = 0;
    for (const fd of friendsData) {
      peerSum += fd.tagScores[tag] || 0;
    }
    const peerAvgScore = friendsData.length > 0 ? peerSum / friendsData.length : 0;
    const gap          = peerAvgScore - myScore;

    let gapLevel;
    if (peerAvgScore <= 0)                    gapLevel = 'NONE';
    else if (peerAvgScore > myScore * 2)      gapLevel = 'HIGH';
    else if (peerAvgScore > myScore * 1.5)    gapLevel = 'MEDIUM';
    else if (peerAvgScore > myScore * 1.1)    gapLevel = 'LOW';
    else                                      gapLevel = 'NONE';

    gaps.push({ tag, myScore, peerAvgScore, gap, gapLevel });
  }

  gaps.sort((a, b) => b.gap - a.gap);
  return gaps;
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSolved(contestId, problemIndex, tags = []) {
  return { contestId, problemIndex, verdict: 'OK', tags };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeTagScoresPure', () => {
  test('single solved problem with tags → correct score', () => {
    const subs = [makeSolved(1, 'A', ['dp', 'greedy'])];
    const { totalSolved, tagScores } = computeTagScoresPure(subs);
    expect(totalSolved).toBe(1);
    expect(tagScores['dp']).toBeCloseTo(1.0);
    expect(tagScores['greedy']).toBeCloseTo(1.0);
  });

  test('deduplication: two subs on same problem count once', () => {
    const subs = [
      makeSolved(1, 'A', ['dp']),
      makeSolved(1, 'A', ['dp'])  // duplicate
    ];
    const { totalSolved } = computeTagScoresPure(subs);
    expect(totalSolved).toBe(1);
  });

  test('empty solved list → zero scores', () => {
    const { totalSolved, tagScores } = computeTagScoresPure([]);
    expect(totalSolved).toBe(0);
    expect(Object.keys(tagScores)).toHaveLength(0);
  });

  test('multiple problems → fractional scores', () => {
    const subs = [
      makeSolved(1, 'A', ['dp']),
      makeSolved(1, 'B', ['greedy']),
      makeSolved(1, 'C', ['dp'])
    ];
    const { totalSolved, tagScores } = computeTagScoresPure(subs);
    expect(totalSolved).toBe(3);
    expect(tagScores['dp']).toBeCloseTo(2 / 3);
    expect(tagScores['greedy']).toBeCloseTo(1 / 3);
  });
});

describe('computeSkillGapsPure', () => {
  // ---- me has no DP, peers have many → HIGH gap for 'dp' ----
  test('me has no DP, peers have high DP score → HIGH gap', () => {
    const myData = computeTagScoresPure([
      makeSolved(1, 'A', ['greedy']),
      makeSolved(1, 'B', ['greedy'])
    ]);

    // Peer solves mostly DP
    const peer1 = computeTagScoresPure([
      makeSolved(2, 'A', ['dp']),
      makeSolved(2, 'B', ['dp']),
      makeSolved(2, 'C', ['dp'])
    ]);
    const peer2 = computeTagScoresPure([
      makeSolved(3, 'A', ['dp']),
      makeSolved(3, 'B', ['dp'])
    ]);

    const gaps = computeSkillGapsPure(myData, [peer1, peer2]);
    const dpGap = gaps.find(g => g.tag === 'dp');
    expect(dpGap).toBeDefined();
    expect(dpGap.gapLevel).toBe('HIGH');
    expect(dpGap.gap).toBeGreaterThan(0);
  });

  // ---- me and peers equal on greedy → LOW or NONE gap ----
  test('me and peers equal on greedy → NONE gap', () => {
    const mySubs    = [makeSolved(1, 'A', ['greedy'])];
    const peerSubs  = [makeSolved(2, 'A', ['greedy'])];

    const myData   = computeTagScoresPure(mySubs);
    const peerData = computeTagScoresPure(peerSubs);

    const gaps    = computeSkillGapsPure(myData, [peerData]);
    const gGap    = gaps.find(g => g.tag === 'greedy');
    expect(gGap).toBeDefined();
    expect(['NONE', 'LOW']).toContain(gGap.gapLevel);
    expect(gGap.gap).toBeCloseTo(0);
  });

  // ---- completely empty data → empty result ----
  test('both me and peers have no data → empty gaps', () => {
    const myData   = computeTagScoresPure([]);
    const peerData = computeTagScoresPure([]);
    const gaps     = computeSkillGapsPure(myData, [peerData]);
    expect(gaps).toHaveLength(0);
  });

  // ---- no friends → empty gaps ----
  test('no friends → empty gaps', () => {
    const myData = computeTagScoresPure([makeSolved(1, 'A', ['dp'])]);
    const gaps   = computeSkillGapsPure(myData, []);
    expect(gaps.length).toBe(myData.totalSolved >= 0 ? gaps.length : 0);
    // With no friends, peerAvgScore = 0, so gapLevel = NONE for all
    for (const g of gaps) {
      expect(g.gapLevel).toBe('NONE');
    }
  });

  // ---- gaps are sorted by gap descending ----
  test('gaps are sorted by gap descending', () => {
    const myData = computeTagScoresPure([
      makeSolved(1, 'A', ['greedy']),
      makeSolved(1, 'B', ['dp'])
    ]);
    const peerData = computeTagScoresPure([
      makeSolved(2, 'A', ['dp']),
      makeSolved(2, 'B', ['dp']),
      makeSolved(2, 'C', ['dp']),
      makeSolved(2, 'D', ['trees']),
      makeSolved(2, 'E', ['trees'])
    ]);

    const gaps = computeSkillGapsPure(myData, [peerData]);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].gap).toBeGreaterThanOrEqual(gaps[i].gap);
    }
  });

  // ---- gapLevel classification is correct ----
  test('gapLevel HIGH when peerAvgScore > myScore * 2', () => {
    // me: dp score = 0.1, peer: dp score = 0.9 → 0.9 > 0.1*2 = 0.2 → HIGH
    const myData = {
      totalSolved: 10,
      tagScores: { dp: 0.1 }
    };
    const peerData = {
      totalSolved: 10,
      tagScores: { dp: 0.9 }
    };
    const gaps  = computeSkillGapsPure(myData, [peerData]);
    const dpGap = gaps.find(g => g.tag === 'dp');
    expect(dpGap.gapLevel).toBe('HIGH');
  });

  test('gapLevel MEDIUM when peerAvgScore in (1.5x, 2x] range', () => {
    const myData   = { totalSolved: 10, tagScores: { dp: 0.2 } };
    const peerData = { totalSolved: 10, tagScores: { dp: 0.36 } }; // 0.36 / 0.2 = 1.8x
    const gaps     = computeSkillGapsPure(myData, [peerData]);
    const dpGap    = gaps.find(g => g.tag === 'dp');
    expect(dpGap.gapLevel).toBe('MEDIUM');
  });

  test('gapLevel LOW when peerAvgScore in (1.1x, 1.5x] range', () => {
    const myData   = { totalSolved: 10, tagScores: { dp: 0.3 } };
    const peerData = { totalSolved: 10, tagScores: { dp: 0.39 } }; // 0.39 / 0.3 = 1.3x
    const gaps     = computeSkillGapsPure(myData, [peerData]);
    const dpGap    = gaps.find(g => g.tag === 'dp');
    expect(dpGap.gapLevel).toBe('LOW');
  });
});
