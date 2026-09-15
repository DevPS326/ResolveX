'use strict';

const { mapSubmission } = require('../services/syncService');

const baseSub = {
  id:                   12345,
  contestId:            1900,
  creationTimeSeconds:  1700000000,
  relativeTimeSeconds:  3600,
  problem: {
    contestId: 1900,
    index:     'C',
    name:      'Test Problem',
    rating:    1900,
    tags:      ['dp', 'trees']
  },
  verdict:             'OK',
  programmingLanguage: 'GNU C++17 (64)'
};

describe('mapSubmission', () => {
  test('maps a standard submission correctly', () => {
    const m = mapSubmission('testuser', baseSub);
    expect(m.submissionId).toBe(12345);
    expect(m.handle).toBe('testuser');
    expect(m.contestId).toBe(1900);
    expect(m.problemIndex).toBe('C');
    expect(m.problemName).toBe('Test Problem');
    expect(m.problemRating).toBe(1900);
    expect(m.tags).toEqual(['dp', 'trees']);
    expect(m.verdict).toBe('OK');
    expect(m.programmingLanguage).toBe('GNU C++17 (64)');
    expect(m.submissionUrl).toBe('https://codeforces.com/contest/1900/submission/12345');
    expect(m.sourceAvailable).toBe(false);
    expect(m.sourceFetchStatus).toBe('PENDING');
  });

  test('preserves non-OK verdicts (WA, TLE, RE, etc.)', () => {
    const verdicts = ['WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'RUNTIME_ERROR', 'COMPILATION_ERROR'];
    verdicts.forEach(v => {
      const m = mapSubmission('user', { ...baseSub, verdict: v });
      expect(m.verdict).toBe(v);
    });
  });

  test('falls back to UNKNOWN verdict when verdict is absent', () => {
    const sub = { ...baseSub, verdict: undefined };
    const m   = mapSubmission('user', sub);
    expect(m.verdict).toBe('UNKNOWN');
  });

  test('handles missing contestId: builds fallback URL', () => {
    const sub = { ...baseSub, contestId: undefined };
    const m   = mapSubmission('user', sub);
    // contestId from problem object should be used
    expect(m.contestId).toBe(1900);
    expect(m.submissionUrl).toContain('/contest/1900/submission/12345');
  });

  test('handles fully absent contestId: uses /submission/ URL', () => {
    const sub = {
      ...baseSub,
      contestId: undefined,
      problem:   { ...baseSub.problem, contestId: undefined }
    };
    const m = mapSubmission('user', sub);
    expect(m.contestId).toBeNull();
    expect(m.submissionUrl).toBe('https://codeforces.com/submission/12345');
  });

  test('handles missing problem rating gracefully', () => {
    const sub = { ...baseSub, problem: { ...baseSub.problem, rating: undefined } };
    const m   = mapSubmission('user', sub);
    expect(m.problemRating).toBeNull();
  });

  test('handles empty tags array', () => {
    const sub = { ...baseSub, problem: { ...baseSub.problem, tags: [] } };
    const m   = mapSubmission('user', sub);
    expect(m.tags).toEqual([]);
  });

  test('handles missing creationTimeSeconds', () => {
    const sub = { ...baseSub, creationTimeSeconds: undefined };
    const m   = mapSubmission('user', sub);
    expect(m.creationTimeSeconds).toBeNull();
  });
});
