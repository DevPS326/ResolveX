'use strict';

const { computeEditorialTiming } = require('../services/editorialService');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
const TS = 1700000000; // arbitrary base timestamp (seconds)

function makeSub(overrides = {}) {
  return {
    submissionId:        overrides.submissionId        || 1,
    handle:              overrides.handle              || 'testUser',
    verdict:             overrides.verdict             || 'WRONG_ANSWER',
    creationTimeSeconds: overrides.creationTimeSeconds != null
                           ? overrides.creationTimeSeconds
                           : TS
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('computeEditorialTiming', () => {
  const editorialTs = new Date(TS * 1000 + 3600 * 1000); // 1 hour after base

  // All attempts before editorial
  test('all attempts before editorial → firstAttemptBefore: true, allAttemptsBefore: true', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: TS - 7200 }),
      makeSub({ submissionId: 2, verdict: 'WRONG_ANSWER', creationTimeSeconds: TS - 3600 }),
      makeSub({ submissionId: 3, verdict: 'OK',           creationTimeSeconds: TS - 1800 })
    ];
    const result = computeEditorialTiming(editorialTs, subs);
    expect(result.firstAttemptBefore).toBe(true);
    expect(result.allAttemptsBefore).toBe(true);
    expect(result.acBeforeEditorial).toBe(true);
    expect(result.editorialAvailableAt).toBe(editorialTs);
  });

  // AC only after editorial
  test('AC only after editorial → acBeforeEditorial: false', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: TS - 100 }),
      makeSub({ submissionId: 2, verdict: 'OK',           creationTimeSeconds: TS + 7200 })
    ];
    const result = computeEditorialTiming(editorialTs, subs);
    expect(result.acBeforeEditorial).toBe(false);
    expect(result.allAttemptsBefore).toBe(false);
  });

  // Mixed: first attempt before editorial, last attempt after
  test('mixed attempts → firstAttemptBefore: true, allAttemptsBefore: false', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: TS - 3600 }),
      makeSub({ submissionId: 2, verdict: 'WRONG_ANSWER', creationTimeSeconds: TS + 7200 }),
      makeSub({ submissionId: 3, verdict: 'OK',           creationTimeSeconds: TS + 7300 })
    ];
    const result = computeEditorialTiming(editorialTs, subs);
    expect(result.firstAttemptBefore).toBe(true);
    expect(result.allAttemptsBefore).toBe(false);
    expect(result.acBeforeEditorial).toBe(false);
  });

  // No editorial
  test('no editorial (null) → flags are false', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'OK', creationTimeSeconds: TS })
    ];
    const result = computeEditorialTiming(null, subs);
    expect(result.editorialAvailableAt).toBeNull();
    expect(result.firstAttemptBefore).toBe(false);
    expect(result.allAttemptsBefore).toBe(false);
    expect(result.acBeforeEditorial).toBe(false);
  });

  // Empty submissions
  test('empty submissions → all false', () => {
    const result = computeEditorialTiming(editorialTs, []);
    expect(result.firstAttemptBefore).toBe(false);
    expect(result.allAttemptsBefore).toBe(false);
    expect(result.acBeforeEditorial).toBe(false);
    expect(result.submissions).toHaveLength(0);
  });

  // Submissions sorted in output
  test('submissions are sorted chronologically in output', () => {
    const subs = [
      makeSub({ submissionId: 3, creationTimeSeconds: TS + 100 }),
      makeSub({ submissionId: 1, creationTimeSeconds: TS - 100 }),
      makeSub({ submissionId: 2, creationTimeSeconds: TS })
    ];
    const result = computeEditorialTiming(editorialTs, subs);
    const times  = result.submissions.map(s => s.creationTimeSeconds);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  // No AC in submissions
  test('no AC submission → acBeforeEditorial: false', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: TS - 1000 })
    ];
    const result = computeEditorialTiming(editorialTs, subs);
    expect(result.acBeforeEditorial).toBe(false);
  });
});
