'use strict';

/**
 * Editorial Service
 *
 * LIMITATION: Auto-discovery of editorial blog entry IDs from contest IDs is
 * not reliably available via Codeforces API. Manual registration via
 * POST /api/editorials/:contestId is the primary mechanism.
 *
 * What IS available:
 *   - If we know a blogEntryId, we can fetch its metadata (title, creationTime)
 *     via the CF blogEntry.view API.
 *   - We can verify a contest exists via contest.standings.
 */

const axios    = require('axios');
const Editorial = require('../models/Editorial');

const CF_API_BASE = process.env.CF_API_BASE || 'https://codeforces.com/api';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function cfGet(url) {
  const res = await axios.get(url, { timeout: 10000 });
  if (res.data.status !== 'OK') {
    throw new Error(res.data.comment || `CF API error: ${res.data.status}`);
  }
  return res.data.result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up (or fetch) the editorial for a contest.
 * Checks DB cache first.  If not cached, verifies contest exists via CF API
 * and returns null (auto-discovery not available).
 *
 * @param {number} contestId
 * @returns {Promise<object|null>}  Editorial Mongoose doc or null
 */
async function getEditorialForContest(contestId) {
  // Check cache
  const cached = await Editorial.findOne({ contestId }).lean();
  if (cached) return cached;

  // Try to verify the contest exists (best-effort — ignore errors)
  try {
    await cfGet(`${CF_API_BASE}/contest.standings?contestId=${contestId}&from=1&count=1`);
  } catch (_err) {
    // Contest may not exist or API unavailable — still return null
  }

  // Cannot auto-discover editorial — return null
  return null;
}

/**
 * Manually register / update an editorial record for a contest.
 *
 * @param {number} contestId
 * @param {{ editorialUrl?, blogEntryId?, availableAt?, title? }} data
 * @returns {Promise<object>}  Updated Editorial doc
 */
async function setEditorialManually(contestId, { editorialUrl, blogEntryId, availableAt, title } = {}) {
  const update = {
    editorialUrl:       editorialUrl  || null,
    blogEntryId:        blogEntryId   != null ? Number(blogEntryId) : null,
    availableAt:        availableAt   ? new Date(availableAt) : null,
    title:              title         || null,
    editorialAvailable: !!(editorialUrl),
    fetchStatus:        editorialUrl ? 'FOUND' : 'NOT_FOUND',
    fetchedAt:          new Date()
  };

  const doc = await Editorial.findOneAndUpdate(
    { contestId },
    { $set: update },
    { upsert: true, new: true }
  );

  return doc;
}

/**
 * Given a known blogEntryId, fetch its metadata from CF API.
 * Returns { title, creationTime, url } or null on failure.
 *
 * @param {number} blogEntryId
 * @returns {Promise<{ title: string, creationTime: number, url: string }|null>}
 */
async function getEditorialByBlogEntry(blogEntryId) {
  try {
    const result = await cfGet(`${CF_API_BASE}/blogEntry.view?blogEntryId=${blogEntryId}`);
    return {
      title:        result.title || null,
      creationTime: result.creationTimeSeconds || null,
      url:          `https://codeforces.com/blog/entry/${blogEntryId}`
    };
  } catch (_err) {
    return null;
  }
}

/**
 * Compare editorial availability time against a friend's submissions for one problem.
 * Pure computation — accepts plain objects (no DB calls).
 *
 * @param {Date|null} editorialAvailableAt
 * @param {Array}     submissions  — Submission docs sorted chronologically
 * @returns {{
 *   editorialAvailableAt: Date|null,
 *   submissions: Array,
 *   firstAttemptBefore: boolean,
 *   allAttemptsBefore: boolean,
 *   acBeforeEditorial: boolean
 * }}
 */
function computeEditorialTiming(editorialAvailableAt, submissions) {
  const editTs = editorialAvailableAt ? new Date(editorialAvailableAt).getTime() / 1000 : null;

  const subs = [...submissions].sort((a, b) =>
    (a.creationTimeSeconds || 0) - (b.creationTimeSeconds || 0)
  );

  const firstAttemptBefore = editTs != null && subs.length > 0
    ? (subs[0].creationTimeSeconds || 0) < editTs
    : false;

  const allAttemptsBefore = editTs != null && subs.length > 0
    ? subs.every(s => (s.creationTimeSeconds || 0) < editTs)
    : false;

  const acSub = subs.find(s => s.verdict === 'OK');
  const acBeforeEditorial = editTs != null && acSub
    ? (acSub.creationTimeSeconds || 0) < editTs
    : false;

  return {
    editorialAvailableAt,
    submissions: subs.map(s => ({
      submissionId:        s.submissionId,
      verdict:             s.verdict,
      creationTimeSeconds: s.creationTimeSeconds
    })),
    firstAttemptBefore,
    allAttemptsBefore,
    acBeforeEditorial
  };
}

module.exports = {
  getEditorialForContest,
  setEditorialManually,
  getEditorialByBlogEntry,
  computeEditorialTiming
};
