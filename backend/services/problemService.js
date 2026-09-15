'use strict';

/**
 * Pure computation functions for problem-level analytics.
 * No DB calls — accepts plain objects, returns plain objects.
 * All functions here must be independently testable without a running DB.
 */

/**
 * Compute attempt timeline analytics for a single (handle, problem) combination.
 *
 * @param {Array} submissions  Stored Submission documents for one handle+problem.
 *                             May arrive in any order; function sorts internally.
 * @returns {Object}
 */
function computeProblemTimeline (submissions) {
  if (!submissions || submissions.length === 0) {
    return {
      attemptCount:    0,
      verdictSequence: [],
      firstAttemptAt:  null,
      acceptedAt:      null,
      solvingDuration: null,
      solved:          false,
      submissions:     []
    };
  }

  // Sort chronologically (oldest first); treat null timestamps as 0
  const sorted = [...submissions].sort((a, b) => {
    const ta = a.creationTimeSeconds != null ? a.creationTimeSeconds : 0;
    const tb = b.creationTimeSeconds != null ? b.creationTimeSeconds : 0;
    return ta - tb;
  });

  const verdictSequence = sorted.map(s => s.verdict);
  const first = sorted[0];
  const acSub = sorted.find(s => s.verdict === 'OK') || null;

  const solvingDuration = (acSub && first.creationTimeSeconds != null && acSub.creationTimeSeconds != null)
    ? acSub.creationTimeSeconds - first.creationTimeSeconds
    : null;

  return {
    attemptCount:    sorted.length,
    verdictSequence,
    firstAttemptAt:  first.creationTimeSeconds,
    acceptedAt:      acSub ? acSub.creationTimeSeconds : null,
    solvingDuration,
    solved:          acSub !== null,
    submissions:     sorted.map(s => ({
      submissionId:        s.submissionId,
      verdict:             s.verdict,
      creationTimeSeconds: s.creationTimeSeconds,
      programmingLanguage: s.programmingLanguage,
      submissionUrl:       s.submissionUrl,
      sourceAvailable:     s.sourceAvailable,
      sourceFetchStatus:   s.sourceFetchStatus
    }))
  };
}

/**
 * Group a flat array of submission documents by handle.
 *
 * @param {Array} submissions
 * @returns {Object} { [handle]: submission[] }
 */
function groupSubmissionsByHandle (submissions) {
  const grouped = {};
  for (const sub of submissions) {
    const h = sub.handle;
    if (!grouped[h]) grouped[h] = [];
    grouped[h].push(sub);
  }
  return grouped;
}

/**
 * Extract unique problem records from raw Codeforces API submission objects.
 * Used during sync to populate the Problem collection.
 * Deduplicates by contestId + index.
 *
 * @param {Array} rawCFSubmissions  Raw objects from user.status API
 * @returns {Array} [{ contestId, index, name, rating, tags }]
 */
function extractProblems (rawCFSubmissions) {
  const map = new Map();
  for (const sub of rawCFSubmissions) {
    if (!sub.problem) continue;
    const p  = sub.problem;
    const cid = sub.contestId != null ? sub.contestId
              : (p.contestId  != null ? p.contestId : null);
    const idx = p.index || null;
    if (cid == null || idx == null) continue;
    const key = `${cid}_${idx}`;
    if (!map.has(key)) {
      map.set(key, {
        contestId: cid,
        index:     idx,
        name:      p.name   || null,
        rating:    p.rating != null ? p.rating : null,
        tags:      p.tags   || []
      });
    }
  }
  return Array.from(map.values());
}

module.exports = { computeProblemTimeline, groupSubmissionsByHandle, extractProblems };
