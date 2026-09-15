'use strict';

/**
 * Evidence Service
 *
 * Computes independence signals for a set of submissions on a single problem.
 * Uses conservative, non-accusatory language — only the 4 approved signal labels.
 *
 * IMPORTANT: This service never outputs that someone "copied".
 * It only classifies the evidence using approved labels.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNAL = {
  HIGH:        'HIGH_INDEPENDENT_ATTEMPT_EVIDENCE',
  MIXED:       'MIXED_UNCERTAIN',
  LOW:         'LOW_INDEPENDENT_ATTEMPT_EVIDENCE',
  INSUFFICIENT: 'INSUFFICIENT_DATA'
};

const CONFIDENCE = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

const QUICK_AC_THRESHOLD_SEC = 5 * 60;  // 5 minutes
const LONG_EFFORT_THRESHOLD_SEC = 30 * 60; // 30 minutes

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function editorialTimestamp(editorial) {
  if (!editorial) return null;
  if (editorial.availableAt) return new Date(editorial.availableAt).getTime() / 1000;
  return null;
}

// ---------------------------------------------------------------------------
// Public: computeIndependenceSignal
// ---------------------------------------------------------------------------

/**
 * Compute independence signal for one handle+problem.
 *
 * @param {object[]} submissions  — Submission docs for one handle+problem, any order
 * @param {object|null} editorial — Editorial doc or null
 * @returns {{
 *   signal: string,
 *   confidence: string,
 *   factors: string[]
 * }}
 */
function computeIndependenceSignal(submissions, editorial) {
  // Sort chronologically
  const sorted = [...(submissions || [])].sort((a, b) =>
    (a.creationTimeSeconds || 0) - (b.creationTimeSeconds || 0)
  );

  const total   = sorted.length;
  const factors = [];

  // ---- INSUFFICIENT_DATA: too few submissions ----
  if (total < 2 && !editorial) {
    factors.push('Fewer than 2 submissions with no editorial context — not enough data to evaluate');
    return { signal: SIGNAL.INSUFFICIENT, confidence: CONFIDENCE.LOW, factors };
  }

  if (total === 0) {
    factors.push('No submissions found for this problem');
    return { signal: SIGNAL.INSUFFICIENT, confidence: CONFIDENCE.LOW, factors };
  }

  // ---- Gather facts ----
  const editTs      = editorialTimestamp(editorial);
  const firstSub    = sorted[0];
  const acSub       = sorted.find(s => s.verdict === 'OK');
  const failedBefore = sorted.filter(s =>
    s.verdict !== 'OK' && (editTs == null || (s.creationTimeSeconds || 0) < editTs)
  );

  const firstBeforeEditorial = editTs != null
    ? (firstSub.creationTimeSeconds || 0) < editTs
    : null;

  const acAfterEditorial = editTs != null && acSub
    ? (acSub.creationTimeSeconds || 0) > editTs
    : false;

  const acBeforeEditorial = editTs != null && acSub
    ? (acSub.creationTimeSeconds || 0) < editTs
    : false;

  // Solving duration: first attempt to AC
  const solvingDuration = acSub && firstSub.creationTimeSeconds != null && acSub.creationTimeSeconds != null
    ? acSub.creationTimeSeconds - firstSub.creationTimeSeconds
    : null;

  // Is this a suspiciously quick first-time AC?
  const quickAC = acSub && total === 1 && solvingDuration != null && solvingDuration < QUICK_AC_THRESHOLD_SEC;

  // ---- Collect positive independence factors ----
  let positiveScore = 0;
  let negativeScore = 0;

  if (firstBeforeEditorial === true) {
    positiveScore++;
    factors.push('First attempt was made before the editorial was published');
  }

  if (failedBefore.length >= 2) {
    positiveScore++;
    factors.push(`${failedBefore.length} failed attempts recorded before editorial availability — suggests genuine effort`);
  } else if (failedBefore.length === 1) {
    positiveScore += 0.5;
    factors.push('One failed attempt before editorial — some prior effort observed');
  }

  if (solvingDuration != null && solvingDuration > LONG_EFFORT_THRESHOLD_SEC) {
    positiveScore++;
    factors.push(`Solving duration of ${Math.round(solvingDuration / 60)} minutes suggests sustained independent effort`);
  }

  if (acBeforeEditorial) {
    positiveScore++;
    factors.push('Accepted before editorial was published');
  }

  // ---- Negative factors ----
  if (acAfterEditorial) {
    negativeScore++;
    factors.push('Accepted after editorial was published');
  }

  if (quickAC) {
    negativeScore++;
    factors.push('Single submission, accepted very quickly — limited observable attempt history');
  }

  if (editTs == null) {
    factors.push('No editorial timestamp available — timing comparison not possible');
  }

  if (total < 2) {
    factors.push('Only one submission on record — limited data for analysis');
  }

  // ---- Classify signal ----
  let signal;
  let confidence;

  const netScore = positiveScore - negativeScore;

  // INSUFFICIENT_DATA: no editorial context AND no positive signals AND too few subs
  if (total < 2 && positiveScore === 0 && negativeScore === 0) {
    return { signal: SIGNAL.INSUFFICIENT, confidence: CONFIDENCE.LOW, factors };
  }

  if (netScore >= 2) {
    signal     = SIGNAL.HIGH;
    confidence = positiveScore >= 3 ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;
  } else if (netScore >= 1) {
    signal     = SIGNAL.HIGH;
    confidence = CONFIDENCE.LOW;
  } else if (netScore === 0 && (positiveScore > 0 || negativeScore > 0)) {
    signal     = SIGNAL.MIXED;
    confidence = CONFIDENCE.MEDIUM;
  } else if (netScore < 0) {
    signal     = SIGNAL.LOW;
    confidence = Math.abs(netScore) >= 2 ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM;
  } else {
    // No clear signal
    signal     = SIGNAL.INSUFFICIENT;
    confidence = CONFIDENCE.LOW;
  }

  return { signal, confidence, factors };
}

module.exports = { computeIndependenceSignal };
