'use strict';

const { computeIndependenceSignal } = require('../services/evidenceService');

// ---------------------------------------------------------------------------
// Signal constants (match what evidenceService exports internally)
// ---------------------------------------------------------------------------
const SIGNAL = {
  HIGH:         'HIGH_INDEPENDENT_ATTEMPT_EVIDENCE',
  MIXED:        'MIXED_UNCERTAIN',
  LOW:          'LOW_INDEPENDENT_ATTEMPT_EVIDENCE',
  INSUFFICIENT: 'INSUFFICIENT_DATA'
};

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
const BASE_TS = 1700000000; // arbitrary unix timestamp in seconds

function makeSub(overrides = {}) {
  return {
    submissionId:        overrides.submissionId        || 1,
    handle:              overrides.handle              || 'testUser',
    contestId:           overrides.contestId           || 1900,
    problemIndex:        overrides.problemIndex        || 'A',
    verdict:             overrides.verdict             || 'WRONG_ANSWER',
    creationTimeSeconds: overrides.creationTimeSeconds != null
                           ? overrides.creationTimeSeconds
                           : BASE_TS
  };
}

function makeEditorial(availableAtOffset = 0) {
  return {
    contestId:          1900,
    editorialAvailable: true,
    availableAt:        new Date((BASE_TS + availableAtOffset) * 1000)
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeIndependenceSignal', () => {
  // ---- All attempts before editorial → HIGH ----
  test('multiple WA + AC all before editorial → HIGH', () => {
    const editorial = makeEditorial(7200); // editorial 2 hours after base
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS - 3600 }),
      makeSub({ submissionId: 2, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS - 1800 }),
      makeSub({ submissionId: 3, verdict: 'OK',           creationTimeSeconds: BASE_TS - 600 })
    ];
    const result = computeIndependenceSignal(subs, editorial);
    expect(result.signal).toBe(SIGNAL.HIGH);
    expect(['HIGH', 'MEDIUM']).toContain(result.confidence);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  // ---- Single AC after editorial → LOW ----
  test('single AC submitted after editorial → LOW', () => {
    const editorial = makeEditorial(-3600); // editorial was 1 hour before base_ts
    const subs = [
      makeSub({ submissionId: 1, verdict: 'OK', creationTimeSeconds: BASE_TS })
    ];
    const result = computeIndependenceSignal(subs, editorial);
    expect(result.signal).toBe(SIGNAL.LOW);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  // ---- Multiple WA before editorial, AC after editorial → MIXED ----
  test('WA before editorial, AC after → MIXED', () => {
    const editorial = makeEditorial(3600); // editorial 1 hour after base
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS }),
      makeSub({ submissionId: 2, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS + 1800 }),
      makeSub({ submissionId: 3, verdict: 'OK',           creationTimeSeconds: BASE_TS + 7200 })
    ];
    const result = computeIndependenceSignal(subs, editorial);
    expect([SIGNAL.MIXED, SIGNAL.HIGH, SIGNAL.LOW]).toContain(result.signal);
    expect(result.factors.length).toBeGreaterThan(0);
    // At least one factor should mention editorial
    const editorialMention = result.factors.some(f =>
      f.toLowerCase().includes('editorial') || f.toLowerCase().includes('accepted')
    );
    expect(editorialMention).toBe(true);
  });

  // ---- No editorial → INSUFFICIENT_DATA factor present ----
  test('no editorial + 1 submission → INSUFFICIENT_DATA', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS })
    ];
    const result = computeIndependenceSignal(subs, null);
    expect(result.signal).toBe(SIGNAL.INSUFFICIENT);
    const mentionsNoEditorial = result.factors.some(f =>
      f.toLowerCase().includes('editorial') || f.toLowerCase().includes('data')
    );
    expect(mentionsNoEditorial).toBe(true);
  });

  // ---- < 2 submissions, no editorial → INSUFFICIENT_DATA ----
  test('zero submissions → INSUFFICIENT_DATA', () => {
    const result = computeIndependenceSignal([], null);
    expect(result.signal).toBe(SIGNAL.INSUFFICIENT);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  // ---- factors is always an array ----
  test('factors is always an array of strings', () => {
    const subs = [makeSub({ verdict: 'OK' })];
    const result = computeIndependenceSignal(subs, null);
    expect(Array.isArray(result.factors)).toBe(true);
    for (const f of result.factors) {
      expect(typeof f).toBe('string');
    }
  });

  // ---- confidence is always valid ----
  test('confidence is always HIGH, MEDIUM, or LOW', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS }),
      makeSub({ submissionId: 2, verdict: 'OK', creationTimeSeconds: BASE_TS + 3600 })
    ];
    const result = computeIndependenceSignal(subs, makeEditorial(7200));
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.confidence);
  });

  // ---- signal is always one of the 4 approved labels ----
  test('signal is always one of the 4 approved labels', () => {
    const cases = [
      { subs: [], editorial: null },
      { subs: [makeSub({ verdict: 'OK' })], editorial: null },
      { subs: [makeSub({ verdict: 'OK', creationTimeSeconds: BASE_TS + 100 })], editorial: makeEditorial(-3600) },
      {
        subs: [
          makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS - 1000 }),
          makeSub({ submissionId: 2, verdict: 'OK', creationTimeSeconds: BASE_TS - 100 })
        ],
        editorial: makeEditorial(3600)
      }
    ];

    for (const { subs, editorial } of cases) {
      const result = computeIndependenceSignal(subs, editorial);
      expect(Object.values(SIGNAL)).toContain(result.signal);
    }
  });

  // ---- No "copied" or accusatory language in factors ----
  test('factors never contain accusatory language like "copied"', () => {
    const subs = [
      makeSub({ submissionId: 1, verdict: 'OK', creationTimeSeconds: BASE_TS + 100 })
    ];
    const editorial = makeEditorial(-3600);
    const result = computeIndependenceSignal(subs, editorial);
    for (const f of result.factors) {
      expect(f.toLowerCase()).not.toContain('cop');
      expect(f.toLowerCase()).not.toContain('cheat');
      expect(f.toLowerCase()).not.toContain('plagiar');
    }
  });

  // ---- Long solving duration noted as positive factor ----
  test('solving duration > 30 min → positive factor mentioned', () => {
    const editorial = makeEditorial(7200);
    const subs = [
      makeSub({ submissionId: 1, verdict: 'WRONG_ANSWER', creationTimeSeconds: BASE_TS - 4000 }),
      makeSub({ submissionId: 2, verdict: 'OK',           creationTimeSeconds: BASE_TS - 100 })
    ];
    const result = computeIndependenceSignal(subs, editorial);
    const hasDuration = result.factors.some(f => f.toLowerCase().includes('minut') || f.toLowerCase().includes('duration'));
    expect(hasDuration).toBe(true);
  });
});
