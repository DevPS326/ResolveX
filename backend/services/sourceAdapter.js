'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const crypto  = require('crypto');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CF_BASE = 'https://codeforces.com';

/**
 * Normalize source code: CRLF → LF, trailing whitespace trimmed per line.
 * Returns empty string for null/undefined input.
 * @param {string|null} str
 * @returns {string}
 */
function normalizeSource(str) {
  if (!str) return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n');
}

/**
 * Compute SHA-256 hex hash of a string.
 * @param {string} str
 * @returns {string} 64-char hex string
 */
function hashSource(str) {
  if (!str) return crypto.createHash('sha256').update('').digest('hex');
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Detect Cloudflare challenge pages.
 * @param {string} html
 * @returns {boolean}
 */
function isCloudflareChallenge(html) {
  if (!html) return false;
  return (
    html.includes('cf-browser-verification') ||
    html.includes('Just a moment') ||
    html.includes('cdn-cgi/challenge-platform')
  );
}

/**
 * Extract source code text from a Codeforces submission HTML page.
 * Tries multiple selectors as fallbacks.
 * @param {string} html
 * @returns {string|null}
 */
function extractSourceFromHtml(html) {
  const $ = cheerio.load(html);

  // Primary selector
  let el = $('#program-source-text');
  if (el.length) return el.text();

  // Fallback 1
  el = $('pre.prettyprint');
  if (el.length) return el.first().text();

  // Fallback 2
  el = $('.source-code pre');
  if (el.length) return el.first().text();

  return null;
}

/**
 * Fetch a Codeforces submission page and extract its source code.
 * Never throws — always returns a status object.
 *
 * @param {number} submissionId
 * @param {number|null} contestId
 * @returns {Promise<{ status: string, source: string|null, hash: string|null, fetchedUrl: string|null, reason: string|null }>}
 */
async function fetchSubmissionSource(submissionId, contestId) {
  if (contestId == null) {
    return { status: 'NOT_AVAILABLE', source: null, hash: null, fetchedUrl: null, reason: 'No contestId available' };
  }

  const url = `${CF_BASE}/contest/${contestId}/submission/${submissionId}`;

  let html;
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': USER_AGENT },
      validateStatus: status => true // don't throw on HTTP error codes
    });

    const httpStatus = response.status;

    if (httpStatus === 403 || httpStatus === 429) {
      return { status: 'BLOCKED', source: null, hash: null, fetchedUrl: url, reason: `HTTP ${httpStatus}` };
    }

    html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

  } catch (err) {
    return { status: 'ERROR', source: null, hash: null, fetchedUrl: url, reason: err.message };
  }

  if (isCloudflareChallenge(html)) {
    return { status: 'BLOCKED', source: null, hash: null, fetchedUrl: url, reason: 'Cloudflare challenge detected' };
  }

  const rawSource = extractSourceFromHtml(html);
  if (rawSource === null) {
    return { status: 'PARSE_ERROR', source: null, hash: null, fetchedUrl: url, reason: 'Source element not found in page' };
  }

  const normalized = normalizeSource(rawSource);
  const hash = hashSource(normalized);

  return {
    status:     'SUCCESS',
    source:     rawSource,
    hash,
    fetchedUrl: url,
    reason:     null
  };
}

module.exports = {
  fetchSubmissionSource,
  normalizeSource,
  hashSource,
  isCloudflareChallenge
};
