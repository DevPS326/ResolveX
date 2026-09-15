'use strict';

const Submission = require('../models/Submission');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute median of a numeric array.
 * Returns null for empty array.
 * @param {number[]} arr
 * @returns {number|null}
 */
function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Convert a unix timestamp (seconds) to a JS Date.
 * @param {number} ts
 * @returns {Date}
 */
function tsToDate(ts) {
  return new Date(ts * 1000);
}

// ---------------------------------------------------------------------------
// Core fingerprint computation
// ---------------------------------------------------------------------------

/**
 * Build a fingerprint for a single handle using MongoDB aggregations.
 * No live CF calls.
 *
 * @param {string} handle
 * @returns {Promise<object>}
 */
async function computeFriendFingerprint(handle) {
  const allSubs = await Submission.find({ handle }).lean();

  const now       = Date.now() / 1000;
  const day7ago   = now - 7 * 86400;
  const day30ago  = now - 30 * 86400;

  // ---- Verdict distribution ----
  const verdictDistribution = {};
  for (const s of allSubs) {
    const v = s.verdict || 'UNKNOWN';
    verdictDistribution[v] = (verdictDistribution[v] || 0) + 1;
  }

  // ---- Language distribution ----
  const languageDistribution = {};
  for (const s of allSubs) {
    if (s.programmingLanguage) {
      languageDistribution[s.programmingLanguage] =
        (languageDistribution[s.programmingLanguage] || 0) + 1;
    }
  }

  // ---- Tag distribution (from solved submissions) ----
  const tagDistribution = {};
  for (const s of allSubs) {
    if (s.verdict === 'OK' && Array.isArray(s.tags)) {
      for (const tag of s.tags) {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      }
    }
  }

  // ---- Rating distribution (from solved) ----
  const ratingBuckets = { '<1200': 0, '1200-1399': 0, '1400-1599': 0, '1600-1799': 0, '1800-1999': 0, '2000+': 0 };
  for (const s of allSubs) {
    if (s.verdict === 'OK' && s.problemRating != null) {
      const r = s.problemRating;
      if      (r < 1200)  ratingBuckets['<1200']++;
      else if (r < 1400)  ratingBuckets['1200-1399']++;
      else if (r < 1600)  ratingBuckets['1400-1599']++;
      else if (r < 1800)  ratingBuckets['1600-1799']++;
      else if (r < 2000)  ratingBuckets['1800-1999']++;
      else                ratingBuckets['2000+']++;
    }
  }

  // ---- Recent activity ----
  let last7days  = 0;
  let last30days = 0;
  for (const s of allSubs) {
    const ts = s.creationTimeSeconds || 0;
    if (ts >= day7ago)  last7days++;
    if (ts >= day30ago) last30days++;
  }

  // ---- Solved problems ----
  // Group by (contestId, problemIndex) to find unique solved problems
  const solvedMap = new Map();
  for (const s of allSubs) {
    if (s.verdict !== 'OK') continue;
    const key = `${s.contestId}_${s.problemIndex}`;
    if (!solvedMap.has(key) || (s.creationTimeSeconds || 0) < (solvedMap.get(key).firstTs || Infinity)) {
      solvedMap.set(key, s);
    }
  }
  const totalSolved = solvedMap.size;

  // ---- Avg attempts to AC ----
  // Group ALL submissions by (contestId, problemIndex) — count attempts per group for solved problems
  const attemptMap = new Map();
  for (const s of allSubs) {
    const key = `${s.contestId}_${s.problemIndex}`;
    if (!attemptMap.has(key)) attemptMap.set(key, []);
    attemptMap.get(key).push(s);
  }

  let totalAttempts = 0;
  let solvedGroups  = 0;
  for (const [key, subs] of attemptMap.entries()) {
    const hasSolved = subs.some(s => s.verdict === 'OK');
    if (hasSolved) {
      totalAttempts += subs.length;
      solvedGroups++;
    }
  }
  const avgAttemptsToAC = solvedGroups > 0
    ? parseFloat((totalAttempts / solvedGroups).toFixed(2))
    : null;

  // ---- Median solving duration ----
  const durations = [];
  for (const [key, subs] of attemptMap.entries()) {
    const sorted  = [...subs].sort((a, b) => (a.creationTimeSeconds || 0) - (b.creationTimeSeconds || 0));
    const acSub   = sorted.find(s => s.verdict === 'OK');
    const firstSub = sorted[0];
    if (acSub && firstSub && firstSub.creationTimeSeconds != null && acSub.creationTimeSeconds != null) {
      durations.push(acSub.creationTimeSeconds - firstSub.creationTimeSeconds);
    }
  }
  const medianSolvingDuration = median(durations);

  return {
    handle,
    totalSubmissions:       allSubs.length,
    totalSolved,
    avgAttemptsToAC,
    verdictDistribution,
    languageDistribution,
    tagDistribution,
    ratingDistribution:     ratingBuckets,
    recentActivity:         { last7days, last30days },
    medianSolvingDuration
  };
}

/**
 * Same as computeFriendFingerprint, labeled as 'me'.
 * @param {string} handle
 * @returns {Promise<object>}
 */
async function computeMyProfile(handle) {
  return computeFriendFingerprint(handle);
}

/**
 * Aggregate fingerprint across multiple handles.
 * @param {string[]} handles
 * @returns {Promise<object>}
 */
async function computeGroupFingerprint(handles) {
  const profiles = await Promise.all(handles.map(h => computeFriendFingerprint(h)));

  const group = {
    handles,
    totalSubmissions:     0,
    totalSolved:          0,
    verdictDistribution:  {},
    languageDistribution: {},
    tagDistribution:      {},
    ratingDistribution:   { '<1200': 0, '1200-1399': 0, '1400-1599': 0, '1600-1799': 0, '1800-1999': 0, '2000+': 0 },
    recentActivity:       { last7days: 0, last30days: 0 }
  };

  for (const p of profiles) {
    group.totalSubmissions += p.totalSubmissions;
    group.totalSolved      += p.totalSolved;
    group.recentActivity.last7days  += p.recentActivity.last7days;
    group.recentActivity.last30days += p.recentActivity.last30days;

    for (const [k, v] of Object.entries(p.verdictDistribution)) {
      group.verdictDistribution[k] = (group.verdictDistribution[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(p.languageDistribution)) {
      group.languageDistribution[k] = (group.languageDistribution[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(p.tagDistribution)) {
      group.tagDistribution[k] = (group.tagDistribution[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(p.ratingDistribution)) {
      group.ratingDistribution[k] = (group.ratingDistribution[k] || 0) + v;
    }
  }

  return group;
}

module.exports = {
  computeFriendFingerprint,
  computeMyProfile,
  computeGroupFingerprint
};
