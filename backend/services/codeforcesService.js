'use strict';

const axios = require('axios');

const CF_API_BASE = process.env.CF_API_BASE || 'https://codeforces.com/api';
const PAGE_SIZE = 100;
// Conservative: ~2.5 req/sec. Codeforces documented limit is ~5/sec.
const REQUEST_INTERVAL_MS = 400;

/**
 * Single shared rate-limited queue for all Codeforces API requests.
 * No other part of the codebase should introduce arbitrary delays.
 */
class RateLimitedQueue {
  constructor (intervalMs) {
    this._queue = [];
    this._running = false;
    this._intervalMs = intervalMs;
    this._lastRequestTime = 0;
  }

  enqueue (fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject });
      if (!this._running) this._drain();
    });
  }

  async _drain () {
    this._running = true;
    while (this._queue.length > 0) {
      const { fn, resolve, reject } = this._queue.shift();
      const elapsed = Date.now() - this._lastRequestTime;
      const wait = Math.max(0, this._intervalMs - elapsed);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this._lastRequestTime = Date.now();
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    }
    this._running = false;
  }
}

const queue = new RateLimitedQueue(REQUEST_INTERVAL_MS);

/**
 * Make a GET request through the rate-limited queue.
 * Throws if the CF API returns status !== 'OK'.
 */
async function cfGet (url) {
  return queue.enqueue(async () => {
    try {
      const res = await axios.get(url, { timeout: 15000 });
      if (res.data.status !== 'OK') {
        throw new Error(res.data.comment || `CF API error: ${res.data.status}`);
      }
      return res.data.result;
    } catch (err) {
      // CF reports a bad request as HTTP 400 with { status, comment }, which
      // axios throws on before the check above ever runs. Lift the comment out
      // so callers learn which handle was rejected instead of 'status code 400'.
      const comment = err.response && err.response.data && err.response.data.comment;
      if (comment) throw new Error(comment);
      throw err;
    }
  });
}

/**
 * Fetch user info for one or more handles (semicolon-separated on CF API).
 * Returns array of user objects.
 */
async function getUserInfo (handles) {
  const param = Array.isArray(handles) ? handles.join(';') : handles;
  return cfGet(`${CF_API_BASE}/user.info?handles=${encodeURIComponent(param)}`);
}

/**
 * Fetch a single page of user.status submissions.
 * from: 1-indexed offset (newest-first ordering from CF)
 * count: page size
 */
async function getSubmissionsPage (handle, from, count) {
  return cfGet(
    `${CF_API_BASE}/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${count}`
  );
}

/**
 * Filter a single page of submissions against an incremental cursor.
 * Submissions from CF are newest-first; we stop when we hit an id <= cursor.
 *
 * @param {Array}  page   - Array of CF submission objects for one page
 * @param {number} cursor - lastSyncedSubmissionId (0 = full history)
 * @returns {{ submissions: Array, reachedCursor: boolean }}
 */
function filterPageByCursor (page, cursor) {
  const submissions = [];
  let reachedCursor = false;
  for (const sub of page) {
    if (sub.id <= cursor) {
      reachedCursor = true;
      break;
    }
    submissions.push(sub);
  }
  return { submissions, reachedCursor };
}

/**
 * Paginate through user.status and return all submissions newer than cursor.
 * cursor = 0 returns full history.
 *
 * @param {string} handle
 * @param {number} cursor - lastSyncedSubmissionId
 * @returns {Promise<Array>} flat array of CF submission objects, newest-first
 */
async function fetchAllSubmissionsSince (handle, cursor = 0) {
  const all = [];
  let from = 1;

  while (true) {
    const page = await getSubmissionsPage(handle, from, PAGE_SIZE);

    if (!page || page.length === 0) break;

    const { submissions, reachedCursor } = filterPageByCursor(page, cursor);
    all.push(...submissions);

    if (reachedCursor || page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

module.exports = {
  getUserInfo,
  getSubmissionsPage,
  filterPageByCursor,
  fetchAllSubmissionsSince,
  PAGE_SIZE
};
