'use strict';

const {
  computeProblemTimeline,
  groupSubmissionsByHandle,
  extractProblems
} = require('../services/problemService');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

// Use spread so overrides can explicitly set null/0/false without being swallowed
// by || / != null guards.
const makeSub = (overrides = {}) => ({
  submissionId:        1,
  handle:              'TestUser',
  contestId:           1900,
  problemIndex:        'C',
  problemName:         'Test Problem',
  problemRating:       1900,
  tags:                ['dp'],
  verdict:             'OK',
  programmingLanguage: 'GNU C++17 (64)',
  creationTimeSeconds: 1700000000,
  relativeTimeSeconds: null,
  submissionUrl:       'https://codeforces.com/contest/1900/submission/1',
  sourceAvailable:     false,
  sourceFetchStatus:   'PENDING',
  ...overrides
});

// Raw CF API submission object (for extractProblems)
const makeRawSub = (overrides = {}) => ({
  id:                  overrides.id             || 99,
  contestId:           overrides.contestId      != null ? overrides.contestId : 1900,
  creationTimeSeconds: overrides.creationTimeSeconds || 1700000000,
  problem: {
    contestId: overrides.problemContestId != null ? overrides.problemContestId : 1900,
    index:     overrides.index            || 'A',
    name:      overrides.name             || 'Problem A',
    rating:    overrides.rating           != null ? overrides.rating : 1200,
    tags:      overrides.tags             || ['greedy']
  },
  verdict:             overrides.verdict        || 'OK',
  programmingLanguage: overrides.lang           || 'GNU C++17 (64)'
});

// ---------------------------------------------------------------------------
// computeProblemTimeline
// ---------------------------------------------------------------------------

describe('computeProblemTimeline', () => {
  test('empty input returns zeroed-out structure', () => {
    const r = computeProblemTimeline([]);
    expect(r.attemptCount).toBe(0);
    expect(r.verdictSequence).toEqual([]);
    expect(r.firstAttemptAt).toBeNull();
    expect(r.acceptedAt).toBeNull();
    expect(r.solvingDuration).toBeNull();
    expect(r.solved).toBe(false);
    expect(r.submissions).toHaveLength(0);
  });

  test('null input behaves same as empty', () => {
    const r = computeProblemTimeline(null);
    expect(r.attemptCount).toBe(0);
    expect(r.solved).toBe(false);
  });

  test('single ACCEPTED submission: solvingDuration is 0', () => {
    const sub = makeSub({ verdict: 'OK', creationTimeSeconds: 1700001000 });
    const r   = computeProblemTimeline([sub]);
    expect(r.attemptCount).toBe(1);
    expect(r.verdictSequence).toEqual(['OK']);
    expect(r.solved).toBe(true);
    expect(r.firstAttemptAt).toBe(1700001000);
    expect(r.acceptedAt).toBe(1700001000);
    expect(r.solvingDuration).toBe(0);
  });

  test('WA → WA → AC: correct sequence and solvingDuration', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER',       creationTimeSeconds: 1000 }),
      makeSub({ submissionId: 2, verdict: 'WRONG_ANSWER',       creationTimeSeconds: 2000 }),
      makeSub({ submissionId: 3, verdict: 'OK',                 creationTimeSeconds: 3600 })
    ];
    const r = computeProblemTimeline(subs);
    expect(r.attemptCount).toBe(3);
    expect(r.verdictSequence).toEqual(['WRONG_ANSWER', 'WRONG_ANSWER', 'OK']);
    expect(r.solved).toBe(true);
    expect(r.firstAttemptAt).toBe(1000);
    expect(r.acceptedAt).toBe(3600);
    expect(r.solvingDuration).toBe(2600);
  });

  test('WA → WA → TLE: unsolved, null acceptedAt and solvingDuration', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER',         creationTimeSeconds: 100 }),
      makeSub({ submissionId: 2, verdict: 'TIME_LIMIT_EXCEEDED',  creationTimeSeconds: 200 })
    ];
    const r = computeProblemTimeline(subs);
    expect(r.solved).toBe(false);
    expect(r.acceptedAt).toBeNull();
    expect(r.solvingDuration).toBeNull();
    expect(r.verdictSequence).toEqual(['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED']);
  });

  test('sorts submissions chronologically regardless of input order', () => {
    // Provide in reverse order
    const subs = [
      makeSub({ submissionId: 3, verdict: 'OK',           creationTimeSeconds: 3000 }),
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: 1000 }),
      makeSub({ submissionId: 2, verdict: 'WRONG_ANSWER', creationTimeSeconds: 2000 })
    ];
    const r = computeProblemTimeline(subs);
    expect(r.verdictSequence).toEqual(['WRONG_ANSWER', 'WRONG_ANSWER', 'OK']);
    expect(r.firstAttemptAt).toBe(1000);
  });

  test('submission output includes required fields', () => {
    const sub = makeSub({ submissionId: 42, verdict: 'OK', creationTimeSeconds: 500 });
    const r   = computeProblemTimeline([sub]);
    const s   = r.submissions[0];
    expect(s).toHaveProperty('submissionId', 42);
    expect(s).toHaveProperty('verdict', 'OK');
    expect(s).toHaveProperty('creationTimeSeconds', 500);
    expect(s).toHaveProperty('programmingLanguage');
    expect(s).toHaveProperty('submissionUrl');
    expect(s).toHaveProperty('sourceAvailable');
    expect(s).toHaveProperty('sourceFetchStatus');
  });

  test('handles null creationTimeSeconds without throwing', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: null }),
      makeSub({ submissionId: 2, verdict: 'OK',           creationTimeSeconds: null })
    ];
    const r = computeProblemTimeline(subs);
    expect(r.attemptCount).toBe(2);
    expect(r.solved).toBe(true);
    // solvingDuration is null because timestamps are null
    expect(r.solvingDuration).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// groupSubmissionsByHandle
// ---------------------------------------------------------------------------

describe('groupSubmissionsByHandle', () => {
  test('groups correctly by handle', () => {
    const subs = [
      makeSub({ handle: 'Alice', submissionId: 1 }),
      makeSub({ handle: 'Bob',   submissionId: 2 }),
      makeSub({ handle: 'Alice', submissionId: 3 })
    ];
    const g = groupSubmissionsByHandle(subs);
    expect(Object.keys(g)).toHaveLength(2);
    expect(g.Alice).toHaveLength(2);
    expect(g.Bob).toHaveLength(1);
  });

  test('empty array returns empty object', () => {
    expect(groupSubmissionsByHandle([])).toEqual({});
  });

  test('single submission', () => {
    const g = groupSubmissionsByHandle([makeSub({ handle: 'Solo' })]);
    expect(g.Solo).toHaveLength(1);
  });

  test('preserves all submissions per handle', () => {
    const subs = Array.from({ length: 5 }, (_, i) =>
      makeSub({ handle: 'User', submissionId: i + 1 })
    );
    const g = groupSubmissionsByHandle(subs);
    expect(g.User).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// extractProblems
// ---------------------------------------------------------------------------

describe('extractProblems', () => {
  test('extracts a single problem', () => {
    const raw = [makeRawSub({ contestId: 1900, index: 'C' })];
    const ps  = extractProblems(raw);
    expect(ps).toHaveLength(1);
    expect(ps[0].contestId).toBe(1900);
    expect(ps[0].index).toBe('C');
  });

  test('deduplicates same contestId + index', () => {
    const raw = [
      makeRawSub({ contestId: 1900, index: 'C', id: 10 }),
      makeRawSub({ contestId: 1900, index: 'C', id: 11 })
    ];
    const ps = extractProblems(raw);
    expect(ps).toHaveLength(1);
  });

  test('returns separate records for different problems', () => {
    const raw = [
      makeRawSub({ contestId: 1900, index: 'A' }),
      makeRawSub({ contestId: 1900, index: 'B' }),
      makeRawSub({ contestId: 2000, index: 'A' })
    ];
    const ps = extractProblems(raw);
    expect(ps).toHaveLength(3);
  });

  test('skips submissions with no problem field', () => {
    const raw = [{ id: 99, verdict: 'OK' }];
    const ps  = extractProblems(raw);
    expect(ps).toHaveLength(0);
  });

  test('skips submissions where contestId cannot be determined', () => {
    const raw = [{
      id:      99,
      problem: { index: 'A', name: 'X', rating: 1000, tags: [] }
      // no contestId on submission or problem
    }];
    const ps = extractProblems(raw);
    expect(ps).toHaveLength(0);
  });

  test('falls back to problem.contestId when top-level contestId is absent', () => {
    const raw = [{
      id:      99,
      // no top-level contestId
      problem: { contestId: 1800, index: 'D', name: 'D', rating: 1800, tags: [] }
    }];
    const ps = extractProblems(raw);
    expect(ps).toHaveLength(1);
    expect(ps[0].contestId).toBe(1800);
  });

  test('empty input returns empty array', () => {
    expect(extractProblems([])).toEqual([]);
  });
});
